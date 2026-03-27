# Bit7 — Full Implementation Plan for New Machine

## What This Is
Bit7 is an iMessage AI agent platform. A Mac server watches for incoming iMessages, routes them through an LLM (Kimi/Moonshot), and sends replies as blue bubbles. The goal is to extend it with:
1. Agentic tool execution (web search, iPhone native actions)
2. iPhone control via iCloud CalDAV + Shortcuts + OAuth
3. No app download required for users

---

## Repo
```
git clone https://github.com/dumapee2-cmyk/Bit7-backend.git
cd Bit7-backend
npm install
```

---

## Environment Setup
Create `.env` in the root:
```
DATABASE_URL=postgresql://neondb_owner:npg_btvRNiT60CEV@ep-summer-violet-akkv0uw3-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require&pgbouncer=true&pool_timeout=60&connect_timeout=30&connection_limit=5
KIMI_API_KEY=sk-78e8Glmng4u8jhoFSjy3MyrBW7qDKwBCQtVxWOgk9NdKp9WK
IMESSAGE_AGENT_ID=68338e18-a8c9-4dc9-af36-195641789abe
PORT=4000
TAVILY_API_KEY=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
DEFAULT_LOCATION=Irvine, CA
```

---

## Running the Server
```bash
npm run build && node dist/server.js
```
Or set up the launchd agent for 24/7 operation (see below).

---

## Current Architecture
```
src/
├── server.ts                          # Express entry point, port 4000
├── types/index.ts                     # AgentSpec, AgentConfig, AgentTool types
├── lib/
│   ├── imessage/
│   │   ├── imessageRuntime.ts         # ← MAIN FILE: iMessage → LLM → reply
│   │   ├── imessageClient.ts          # @photon-ai/imessage-kit wrapper
│   │   └── contactCard.ts             # vCard generation
│   ├── conversationState.ts           # Per-user history + state (Prisma)
│   ├── unifiedClient.ts               # Kimi/Moonshot OpenAI-compatible wrapper
│   ├── vision.ts                      # Image analysis (Kimi vision)
│   ├── webSearch.ts                   # Tavily + Brave fallback
│   └── braveSearch.ts                 # Brave Search API
└── routes/
    ├── agents.ts                      # Agent CRUD
    └── ...
```

### Current Message Flow (`imessageRuntime.ts`)
1. iMessage arrives → `handleIMessage()` fires
2. Load agent spec + conversation history
3. If first-time user: send welcome + contact card
4. If photo attachment: convert HEIC→JPEG via `sips`, analyze with Kimi vision
5. If query needs web search (weather/news/etc): call Tavily `richSearch()`
6. Build LLM messages array (system + history + current)
7. Call Kimi `moonshot-v1-auto`, max_tokens=120, temp=0.7
8. Parse STATE_UPDATE blocks, truncate to 2 sentences
9. Save to DB, send reply via iMessage

---

## What Needs to Be Built

### Feature 1: Agentic Tool Loop (Priority 1)

**Goal**: Replace the single LLM call with a tool-use loop so the agent can call tools (web search, iPhone actions) and get real results before replying.

**File to modify**: `src/lib/imessage/imessageRuntime.ts`

Replace this section (around line 163):
```typescript
// Call LLM
const llm = getRawKimiClient();
const completion = await llm.chat.completions.create({
  model: "moonshot-v1-auto",
  max_tokens: 120,
  temperature: 0.7,
  messages,
});
const rawReply = completion.choices[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
```

With an agentic loop:
```typescript
const llm = getRawKimiClient();
const toolMessages = [...messages];
let rawReply = "";

for (let round = 0; round < 5; round++) {
  const completion = await llm.chat.completions.create({
    model: "moonshot-v1-auto",
    max_tokens: 400,
    temperature: 0.7,
    messages: toolMessages,
    tools: ALL_TOOL_DEFINITIONS,
    tool_choice: "auto",
  });

  const choice = completion.choices[0];

  if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls?.length) {
    rawReply = choice.message?.content ?? "Sorry, I couldn't generate a response.";
    break;
  }

  toolMessages.push(choice.message);

  for (const tc of choice.message.tool_calls) {
    let result: string;
    try {
      const args = JSON.parse(tc.function.arguments ?? "{}");
      result = await executeTool(tc.function.name, args);
      console.log(`[iMessage] Tool ${tc.function.name}: ${result.slice(0, 80)}`);
    } catch (e) {
      result = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
    toolMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
  }
}
```

Also update `buildSystemMessage` to add:
```
You have tools available. Use web_search for any question needing current information. Use iphone_action for calendar, reminders, alarms, health, HomeKit, and music. After using a tool, confirm the result in one sentence.
```

Remove the existing manual `needsSearch` + `richSearch` block — web_search is now a tool.

---

### Feature 2: Tool Definitions + Executors

**File to create**: `src/lib/imessage/agentTools.ts`

```typescript
import { richSearch } from "../webSearch.js";

export const ALL_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information — weather, news, prices, sports scores, facts. Always use for weather queries.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query. For weather, include the location." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "iphone_action",
      description: "Perform a native action on the user's iPhone. Works via iCloud CalDAV for calendar/reminders, Shortcuts for alarms/health/HomeKit. Use for: add calendar event, set reminder, set alarm, read health data, control smart home, play music.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["add_calendar_event", "set_reminder", "set_alarm", "get_health_data", "home_control", "play_music", "send_email"],
            description: "The action to perform"
          },
          params: {
            type: "object",
            description: "Action parameters. add_calendar_event: {title, date (YYYY-MM-DD), start_time (HH:MM), end_time (HH:MM), notes?}. set_reminder: {title, date?, time?}. set_alarm: {time (HH:MM), label?}. get_health_data: {metric: 'steps'|'sleep'|'heart_rate', period: 'today'|'week'}. home_control: {device, action: 'on'|'off'|'set', value?}. play_music: {query, service?: 'spotify'|'apple_music'}. send_email: {to, subject, body}",
            additionalProperties: true
          }
        },
        required: ["action", "params"]
      }
    }
  }
];

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "web_search":
      return executeWebSearch(args.query as string);
    case "iphone_action":
      return executeIphoneAction(args.action as string, args.params as Record<string, unknown>);
    default:
      return `Unknown tool: ${name}`;
  }
}

async function executeWebSearch(query: string): Promise<string> {
  const location = process.env.DEFAULT_LOCATION ?? "Irvine, CA";
  const isWeather = /weather|forecast|temperature|rain|sunny/i.test(query);
  const finalQuery = isWeather ? `${query} ${location}` : query;
  try {
    const { results } = await richSearch(finalQuery, { maxResults: 3, searchDepth: "basic" });
    if (!results.length) return "No search results found.";
    return results.map(r => `${r.title}: ${r.content}`).join("\n").slice(0, 600);
  } catch (e) {
    return `Search failed: ${e instanceof Error ? e.message : e}`;
  }
}

async function executeIphoneAction(action: string, params: Record<string, unknown>): Promise<string> {
  switch (action) {
    case "add_calendar_event":
      return addCalendarEvent(params);
    case "set_reminder":
      return setReminder(params);
    case "set_alarm":
    case "get_health_data":
    case "home_control":
    case "play_music":
      return sendShortcutCommand(action, params);
    case "send_email":
      return sendEmail(params);
    default:
      return `Unknown iPhone action: ${action}`;
  }
}
```

---

### Feature 3: iCloud CalDAV for Calendar + Reminders (no app needed)

**File to create**: `src/lib/imessage/icloudCalDAV.ts`

iCloud Calendar and Reminders are accessible via standard CalDAV protocol. No iOS app needed — just an iCloud app-specific password.

```typescript
// iCloud CalDAV endpoint
const CALDAV_BASE = "https://caldav.icloud.com";

// User provides: iCloud username (Apple ID email) + app-specific password
// App-specific password: appleid.apple.com → Sign-In and Security → App-Specific Passwords

export async function addCalendarEvent(params: {
  title: string;
  date: string;          // YYYY-MM-DD
  start_time: string;    // HH:MM
  end_time: string;      // HH:MM
  notes?: string;
  userAppleId: string;
  userPassword: string;  // app-specific password
}): Promise<string> {
  // 1. Discover calendar URL via PROPFIND
  // 2. PUT a VCALENDAR/VEVENT to the calendar endpoint
  // 3. Returns confirmation

  const uid = `bit7-${Date.now()}@bit7.ai`;
  const dtstart = `${params.date.replace(/-/g, "")}T${params.start_time.replace(":", "")}00`;
  const dtend = `${params.date.replace(/-/g, "")}T${params.end_time.replace(":", "")}00`;

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bit7//Bit7 Agent//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${params.title}`,
    `DTSTART;TZID=America/Los_Angeles:${dtstart}`,
    `DTEND;TZID=America/Los_Angeles:${dtend}`,
    params.notes ? `DESCRIPTION:${params.notes}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  // Discover principal URL first
  const principalRes = await caldavRequest(
    `${CALDAV_BASE}/`,
    "PROPFIND",
    params.userAppleId,
    params.userPassword,
    `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
    1
  );

  // Parse principal, find calendar home, find default calendar, PUT event
  // (full discovery → PUT flow)

  return `Calendar event "${params.title}" added for ${params.date} at ${params.start_time}.`;
}

async function caldavRequest(
  url: string,
  method: string,
  username: string,
  password: string,
  body?: string,
  depth?: number
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "text/xml; charset=utf-8",
    "Authorization": `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  };
  if (depth !== undefined) headers["Depth"] = String(depth);

  const res = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok && res.status !== 207) {
    throw new Error(`CalDAV error: ${res.status} ${res.statusText}`);
  }
  return res.text();
}
```

Add to `.env`:
```
ICLOUD_APPLE_ID=bitseven@icloud.com
ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # generate at appleid.apple.com
```

---

### Feature 4: Shortcuts Command Dispatch (for alarms, health, HomeKit)

**Goal**: Send a structured command as an iMessage to the user's own number. A Personal Automation on their iPhone fires, reads the message via "Get Messages" Shortcuts action, parses the JSON, and executes.

**File to create**: `src/lib/imessage/shortcutDispatch.ts`

```typescript
import { sendIMessage } from "./imessageClient.js";

// Send a command to the user's own iPhone via iMessage
// The user's iPhone has a Personal Automation that watches for messages from this account
// containing "BIT7_CMD:" and runs the Bit7 Dispatcher Shortcut

export async function sendShortcutCommand(
  action: string,
  params: Record<string, unknown>
): Promise<string> {
  const userPhone = ""; // Will be passed from context in final implementation
  const command = JSON.stringify({ action, params });
  const message = `BIT7_CMD:${command}`;

  // Send to user's number — their Personal Automation picks it up
  await sendIMessage(userPhone, message);

  // Wait briefly for execution confirmation (optional)
  await new Promise(r => setTimeout(r, 2000));

  return actionConfirmation(action, params);
}

function actionConfirmation(action: string, params: Record<string, unknown>): string {
  switch (action) {
    case "set_alarm":     return `Alarm set for ${params.time}.`;
    case "get_health_data": return `Health data request sent to your iPhone.`;
    case "home_control":  return `${params.device} turned ${params.action}.`;
    case "play_music":    return `Playing ${params.query}.`;
    default:              return "Done.";
  }
}
```

**iPhone Shortcut setup** (user does once — provide an iCloud Shortcut install link):

The "Bit7 Dispatcher" Shortcut:
```
1. Get Messages → filter: from [Bit7 contact] → sort by date → get first item
2. Get text from Message
3. Get text between "BIT7_CMD:" and end
4. Parse JSON → store as "cmd"
5. Get value for key "action" from cmd
6. If action = "set_alarm":
     Get value for key "params" → time, label
     Create Alarm: time=[time], label=[label]
7. If action = "get_health_data":
     Get Health Sample: [metric] from [period]
     Send Message to [Bit7 contact]: "HEALTH_RESULT:[value]"
8. If action = "home_control":
     Control Home: [device] → [action]
9. If action = "play_music":
     Search [service] for [query] → Play
```

Personal Automation (user sets up once):
- Trigger: Message received from [Bit7 contact] containing "BIT7_CMD:"
- Action: Run Shortcut "Bit7 Dispatcher"
- Ask Before Running: OFF

---

### Feature 5: OAuth Integrations (Spotify, Gmail, etc.)

**File to create**: `src/routes/oauth.ts`

Endpoints:
- `GET /oauth/spotify/connect?phone=+1xxx` — redirect to Spotify OAuth
- `GET /oauth/spotify/callback` — store token in DB
- `GET /oauth/gmail/connect?phone=+1xxx` — redirect to Gmail OAuth
- `GET /oauth/gmail/callback` — store token

**Prisma schema addition** (`prisma/schema.prisma`):
```prisma
model OAuthToken {
  id           String   @id @default(cuid())
  user_phone   String
  service      String   // "spotify", "gmail", "twitter"
  access_token  String
  refresh_token String?
  expires_at   DateTime?
  created_at   DateTime @default(now())
  @@unique([user_phone, service])
}
```

**Tool additions** (in `agentTools.ts`):
```typescript
{
  name: "spotify",
  description: "Control Spotify: play, pause, skip, search, get now playing, add to queue.",
  parameters: { action: enum["play","pause","skip","search","now_playing","queue"], query?: string }
},
{
  name: "gmail",
  description: "Read and send Gmail. Actions: search, read_latest, send, reply, count_unread.",
  parameters: { action: enum["search","read_latest","send","reply","count_unread"], query?: string, to?: string, subject?: string, body?: string }
}
```

---

## LaunchD Agent (24/7 Server)

Create `/Users/<username>/Library/LaunchAgents/com.bit7.server.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.bit7.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/<username>/Bit7-backend/dist/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/<username>/Bit7-backend</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>/Users/<username></string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>/Users/<username>/Bit7-backend/logs/server.log</string>
  <key>StandardErrorPath</key><string>/Users/<username>/Bit7-backend/logs/server.error.log</string>
</dict>
</plist>
```

```bash
mkdir -p ~/Bit7-backend/logs
launchctl load ~/Library/LaunchAgents/com.bit7.server.plist
launchctl list | grep com.bit7  # verify running
tail -f ~/Bit7-backend/logs/server.log
```

Also create `com.bit7.messages.plist` to keep Messages.app running:
```xml
<key>Label</key><string>com.bit7.messages</string>
<key>ProgramArguments</key>
<array>
  <string>/usr/bin/open</string><string>-gj</string><string>-a</string><string>Messages</string>
</array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key>
<dict>
  <key>OtherJobEnabled</key>
  <dict><key>com.bit7.server</key><true/></dict>
</dict>
```

---

## Full Disk Access (Required)

Messages.app must have Full Disk Access for the iMessage watcher to read chat.db:
System Settings → Privacy & Security → Full Disk Access → add Messages.app ✅

---

## Implementation Order

1. **First**: `agentTools.ts` + agentic loop in `imessageRuntime.ts` — gets web search working as a proper tool, eliminates hallucinated "I'll search for that" responses
2. **Second**: iCloud CalDAV (`icloudCalDAV.ts`) — calendar + reminders without any app
3. **Third**: Shortcut dispatch (`shortcutDispatch.ts`) — alarms, health, HomeKit
4. **Fourth**: OAuth routes + Spotify + Gmail tools
5. **Fifth**: LaunchD setup for 24/7 operation

---

## Key Behaviors to Preserve

- Max 2 sentences per reply
- No comma splices — separate thoughts with periods
- Never say "I'll look that up" or "I'll provide more details" — just answer or use a tool
- Truncate to 2 sentences via `truncateToSentences(text, 2)`
- Strip preambles ("got it", "I see", "based on the image", etc.)
- Photo attachments: convert HEIC→JPEG via `sips`, analyze with Kimi vision
- Startup sweep: process messages from last 60s on boot (already implemented)
- First-time users: send welcome message + contact card

---

## Verification

1. `npm run build` — must be clean, zero TypeScript errors
2. Start server: `node dist/server.js`
3. Text "what's the weather in irvine" → logs show `[iMessage] Tool web_search:` → real answer
4. Text "add lunch with John friday at noon" → CalDAV call → event in Calendar
5. Text "set an alarm for 7am" → BIT7_CMD dispatched → iPhone alarm set
6. Text "play something chill on Spotify" → Spotify plays
7. All replies ≤ 2 sentences, no preambles
