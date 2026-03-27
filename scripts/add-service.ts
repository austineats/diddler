#!/usr/bin/env npx tsx
/**
 * add-service — Automates wiring up a new service integration.
 *
 * Usage:
 *   npx tsx scripts/add-service.ts                  # interactive
 *   npx tsx scripts/add-service.ts google-calendar   # by name
 *   npx tsx scripts/add-service.ts --list            # show all available
 *   npx tsx scripts/add-service.ts --batch           # add multiple at once
 *
 * What it does:
 * 1. Queries Nango for available providers
 * 2. Creates the integration in Nango
 * 3. Generates tool definition + executor code
 * 4. Injects into agentTools.ts
 * 5. Rebuilds the project
 */

import { Nango } from "@nangohq/node";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NANGO_SECRET_KEY = process.env.NANGO_SECRET_KEY ?? "540a4938-7f52-4544-957d-746c6c3bc898";
const nango = new Nango({ secretKey: NANGO_SECRET_KEY });

const AGENT_TOOLS_PATH = path.join(__dirname, "../src/lib/imessage/agentTools.ts");

// Pre-built service configs — common services with sensible defaults
const SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  "google-calendar": {
    nangoProvider: "google-calendar",
    toolName: "google_calendar",
    description: "Manage Google Calendar — create events, check schedule, list upcoming. Actions: list_today, list_upcoming, create_event.",
    actions: ["list_today", "list_upcoming", "create_event"],
    paramDocs: "list_today: {}. list_upcoming: {days?: number}. create_event: {title, date:'YYYY-MM-DD', start_time:'HH:MM', end_time:'HH:MM', description?}.",
    executor: generateCalendarExecutor,
  },
  "google-drive": {
    nangoProvider: "google-drive",
    toolName: "google_drive",
    description: "Search and share files from Google Drive. Actions: search, share.",
    actions: ["search", "share"],
    paramDocs: "search: {query}. share: {file_name, email}.",
    executor: generateGenericExecutor,
  },
  "notion": {
    nangoProvider: "notion",
    toolName: "notion",
    description: "Create and search Notion pages, databases, and notes. Actions: search, create_page.",
    actions: ["search", "create_page"],
    paramDocs: "search: {query}. create_page: {title, content}.",
    executor: generateGenericExecutor,
  },
  "todoist": {
    nangoProvider: "todoist",
    toolName: "todoist",
    description: "Manage tasks in Todoist. Actions: list_tasks, add_task, complete_task.",
    actions: ["list_tasks", "add_task", "complete_task"],
    paramDocs: "list_tasks: {}. add_task: {content, due_date?}. complete_task: {task_name}.",
    executor: generateTodoistExecutor,
  },
  "slack": {
    nangoProvider: "slack",
    toolName: "slack",
    description: "Send messages and check channels in Slack. Actions: send_message, list_channels, read_channel.",
    actions: ["send_message", "list_channels", "read_channel"],
    paramDocs: "send_message: {channel, message}. list_channels: {}. read_channel: {channel, count?}.",
    executor: generateGenericExecutor,
  },
  "twitter": {
    nangoProvider: "twitter",
    toolName: "twitter",
    description: "Post tweets and read timeline. Actions: post, timeline, search.",
    actions: ["post", "timeline", "search"],
    paramDocs: "post: {text}. timeline: {count?}. search: {query}.",
    executor: generateGenericExecutor,
  },
  "fitbit": {
    nangoProvider: "fitbit",
    toolName: "fitbit",
    description: "Read health data from Fitbit — steps, sleep, heart rate. Actions: steps, sleep, heart_rate.",
    actions: ["steps", "sleep", "heart_rate"],
    paramDocs: "steps: {date?:'YYYY-MM-DD'}. sleep: {date?}. heart_rate: {date?}.",
    executor: generateFitbitExecutor,
  },
  "linear": {
    nangoProvider: "linear",
    toolName: "linear",
    description: "Manage issues in Linear. Actions: list_issues, create_issue, search.",
    actions: ["list_issues", "create_issue", "search"],
    paramDocs: "list_issues: {status?}. create_issue: {title, description?}. search: {query}.",
    executor: generateGenericExecutor,
  },
  "github": {
    nangoProvider: "github",
    toolName: "github",
    description: "Interact with GitHub — check PRs, issues, notifications. Actions: notifications, list_prs, list_issues.",
    actions: ["notifications", "list_prs", "list_issues"],
    paramDocs: "notifications: {}. list_prs: {repo}. list_issues: {repo}.",
    executor: generateGenericExecutor,
  },
  "dropbox": {
    nangoProvider: "dropbox",
    toolName: "dropbox",
    description: "Search and share files from Dropbox. Actions: search, share.",
    actions: ["search", "share"],
    paramDocs: "search: {query}. share: {path}.",
    executor: generateGenericExecutor,
  },
  "lyft": {
    nangoProvider: "lyft",
    toolName: "lyft",
    description: "Request Lyft rides and check prices. Actions: estimate, request.",
    actions: ["estimate", "request"],
    paramDocs: "estimate: {pickup, dropoff}. request: {pickup, dropoff}.",
    executor: generateGenericExecutor,
  },
};

interface ServiceConfig {
  nangoProvider: string;
  toolName: string;
  description: string;
  actions: string[];
  paramDocs: string;
  executor: (config: ServiceConfig) => string;
}

// --- Executor generators ---

function generateGenericExecutor(config: ServiceConfig): string {
  const actions = config.actions.map(a => `      case "${a}":\n        return \`${config.toolName}/${a} is connected but not fully wired yet. Coming soon.\`;`).join("\n");
  return `
async function execute_${config.toolName}(
  action: string,
  params: Record<string, unknown>,
  token: string,
): Promise<string> {
  const headers = { "Authorization": \`Bearer \${token}\`, "Content-Type": "application/json" };
  try {
    switch (action) {
${actions}
      default:
        return \`Unknown ${config.toolName} action: \${action}\`;
    }
  } catch (e) {
    return \`${config.toolName} error: \${e instanceof Error ? e.message : e}\`;
  }
}`;
}

function generateCalendarExecutor(_config: ServiceConfig): string {
  return `
async function execute_google_calendar(
  action: string,
  params: Record<string, unknown>,
  token: string,
): Promise<string> {
  const headers = { "Authorization": \`Bearer \${token}\` };
  const CAL_API = "https://www.googleapis.com/calendar/v3";
  try {
    switch (action) {
      case "list_today":
      case "list_upcoming": {
        const now = new Date();
        const timeMin = now.toISOString();
        const days = action === "list_today" ? 1 : (params.days as number ?? 7);
        const timeMax = new Date(now.getTime() + days * 86400000).toISOString();
        const res = await fetch(
          \`\${CAL_API}/calendars/primary/events?timeMin=\${timeMin}&timeMax=\${timeMax}&maxResults=10&singleEvents=true&orderBy=startTime\`,
          { headers },
        );
        const data = await res.json() as { items?: { summary?: string; start?: { dateTime?: string; date?: string } }[] };
        if (!data.items?.length) return "No upcoming events.";
        return data.items.map(e => \`\${e.start?.dateTime ?? e.start?.date}: \${e.summary}\`).join("\\n").slice(0, 600);
      }
      case "create_event": {
        const startDT = \`\${params.date}T\${params.start_time}:00\`;
        const endDT = \`\${params.date}T\${params.end_time}:00\`;
        const res = await fetch(\`\${CAL_API}/calendars/primary/events\`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: params.title,
            description: params.description ?? "",
            start: { dateTime: startDT, timeZone: "America/Los_Angeles" },
            end: { dateTime: endDT, timeZone: "America/Los_Angeles" },
          }),
        });
        if (!res.ok) return \`Failed to create event: \${await res.text()}\`;
        return \`Event "\${params.title}" created for \${params.date} at \${params.start_time}.\`;
      }
      default:
        return \`Unknown calendar action: \${action}\`;
    }
  } catch (e) {
    return \`Calendar error: \${e instanceof Error ? e.message : e}\`;
  }
}`;
}

function generateTodoistExecutor(_config: ServiceConfig): string {
  return `
async function execute_todoist(
  action: string,
  params: Record<string, unknown>,
  token: string,
): Promise<string> {
  const headers = { "Authorization": \`Bearer \${token}\`, "Content-Type": "application/json" };
  const API = "https://api.todoist.com/rest/v2";
  try {
    switch (action) {
      case "list_tasks": {
        const res = await fetch(\`\${API}/tasks?filter=today | overdue\`, { headers });
        const tasks = await res.json() as { content: string; due?: { date: string } }[];
        if (!tasks.length) return "No tasks for today.";
        return tasks.map(t => \`• \${t.content}\${t.due ? \` (due \${t.due.date})\` : ""}\`).join("\\n").slice(0, 600);
      }
      case "add_task": {
        const res = await fetch(\`\${API}/tasks\`, {
          method: "POST", headers,
          body: JSON.stringify({ content: params.content, due_date: params.due_date }),
        });
        if (!res.ok) return "Failed to add task.";
        return \`Task added: "\${params.content}".\`;
      }
      case "complete_task": {
        const searchRes = await fetch(\`\${API}/tasks?filter=\${encodeURIComponent(params.task_name as string)}\`, { headers });
        const tasks = await searchRes.json() as { id: string; content: string }[];
        const task = tasks[0];
        if (!task) return \`No task found matching "\${params.task_name}".\`;
        await fetch(\`\${API}/tasks/\${task.id}/close\`, { method: "POST", headers });
        return \`Task "\${task.content}" completed.\`;
      }
      default:
        return \`Unknown todoist action: \${action}\`;
    }
  } catch (e) {
    return \`Todoist error: \${e instanceof Error ? e.message : e}\`;
  }
}`;
}

function generateFitbitExecutor(_config: ServiceConfig): string {
  return `
async function execute_fitbit(
  action: string,
  params: Record<string, unknown>,
  token: string,
): Promise<string> {
  const headers = { "Authorization": \`Bearer \${token}\` };
  const date = (params.date as string) ?? "today";
  const API = "https://api.fitbit.com/1/user/-";
  try {
    switch (action) {
      case "steps": {
        const res = await fetch(\`\${API}/activities/date/\${date}.json\`, { headers });
        const data = await res.json() as { summary?: { steps?: number } };
        return \`Steps \${date}: \${data.summary?.steps ?? "unknown"}.\`;
      }
      case "sleep": {
        const res = await fetch(\`\${API}/sleep/date/\${date}.json\`, { headers });
        const data = await res.json() as { summary?: { totalMinutesAsleep?: number } };
        const mins = data.summary?.totalMinutesAsleep ?? 0;
        return \`Sleep \${date}: \${Math.floor(mins / 60)}h \${mins % 60}m.\`;
      }
      case "heart_rate": {
        const res = await fetch(\`\${API}/activities/heart/date/\${date}/1d.json\`, { headers });
        const data = await res.json() as { "activities-heart"?: { value?: { restingHeartRate?: number } }[] };
        const rhr = data["activities-heart"]?.[0]?.value?.restingHeartRate;
        return rhr ? \`Resting heart rate \${date}: \${rhr} bpm.\` : "Heart rate data not available.";
      }
      default:
        return \`Unknown fitbit action: \${action}\`;
    }
  } catch (e) {
    return \`Fitbit error: \${e instanceof Error ? e.message : e}\`;
  }
}`;
}

// --- Code generation ---

function generateToolDefinition(config: ServiceConfig): string {
  const actionsEnum = config.actions.map(a => `"${a}"`).join(", ");
  return `  {
    type: "function" as const,
    function: {
      name: "${config.toolName}",
      description: "${config.description}",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [${actionsEnum}],
            description: "The ${config.toolName} action to perform",
          },
          params: {
            type: "object",
            description: "${config.paramDocs}",
            additionalProperties: true,
          },
        },
        required: ["action"],
      },
    },
  },`;
}

function generateCaseHandler(config: ServiceConfig): string {
  return `    case "${config.toolName}": {
      const token = await getServiceToken("${config.nangoProvider}", userPhone);
      if (!token) {
        try {
          const connectUrl = await getConnectUrl("${config.nangoProvider}", userPhone);
          return \`NEEDS_SETUP:${config.toolName}:To use ${config.toolName.replace(/_/g, " ")}, connect here: \${connectUrl}\`;
        } catch {
          return \`NEEDS_SETUP:${config.toolName}:${config.toolName.replace(/_/g, " ")} integration isn't configured yet.\`;
        }
      }
      return execute_${config.toolName}(
        args.action as string,
        (args.params as Record<string, unknown>) ?? {},
        token,
      );
    }`;
}

// --- File manipulation ---

function injectIntoAgentTools(config: ServiceConfig): void {
  let code = fs.readFileSync(AGENT_TOOLS_PATH, "utf-8");

  // Check if already added
  if (code.includes(`name: "${config.toolName}"`)) {
    console.log(`  ⏭  Tool "${config.toolName}" already exists in agentTools.ts — skipping`);
    return;
  }

  // 1. Add tool definition before the closing ];
  const toolDef = generateToolDefinition(config);
  code = code.replace(
    /^(\];)\s*\n\s*\/\*\*\s*\n\s*\* Execute a tool call/m,
    `${toolDef}\n];\n\n/**\n * Execute a tool call`,
  );

  // 2. Add case handler before the default case
  const caseHandler = generateCaseHandler(config);
  code = code.replace(
    /(\s+default:\s*\n\s*return `Unknown tool:)/,
    `${caseHandler}\n    default:\n      return \`Unknown tool:`,
  );

  // Fix the double default
  code = code.replace(
    /default:\n\s*return `Unknown tool:.*\n\s*default:\n\s*return `Unknown tool:/,
    `default:\n      return \`Unknown tool:`,
  );

  // 3. Add executor function at the end
  const executorCode = config.executor(config);
  code = code.trimEnd() + "\n" + executorCode + "\n";

  fs.writeFileSync(AGENT_TOOLS_PATH, code);
  console.log(`  ✅ Injected tool definition + executor for "${config.toolName}"`);
}

async function registerNangoIntegration(config: ServiceConfig): Promise<boolean> {
  try {
    await nango.createIntegration({
      provider: config.nangoProvider,
      unique_key: config.nangoProvider,
    });
    console.log(`  ✅ Created Nango integration: ${config.nangoProvider}`);
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("409")) {
      console.log(`  ⏭  Nango integration "${config.nangoProvider}" already exists`);
      return true;
    }
    console.log(`  ⚠️  Nango integration creation failed: ${msg}`);
    console.log(`     → Add "${config.nangoProvider}" manually at app.nango.dev`);
    return false;
  }
}

// --- CLI ---

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

async function listAvailable(): Promise<void> {
  console.log("\n📦 Available pre-configured services:\n");
  for (const [key, config] of Object.entries(SERVICE_CONFIGS)) {
    console.log(`  ${key.padEnd(20)} ${config.description.slice(0, 60)}...`);
  }
  console.log(`\n  Total: ${Object.keys(SERVICE_CONFIGS).length} services`);
  console.log(`\n  Usage: npx tsx scripts/add-service.ts <service-name>`);
  console.log(`         npx tsx scripts/add-service.ts --batch\n`);
}

async function addService(name: string): Promise<void> {
  const config = SERVICE_CONFIGS[name];
  if (!config) {
    console.error(`\n❌ Unknown service: "${name}"`);
    console.log("   Run with --list to see available services\n");
    return;
  }

  console.log(`\n🔧 Adding ${name}...\n`);

  // 1. Register in Nango
  await registerNangoIntegration(config);

  // 2. Inject code
  injectIntoAgentTools(config);

  console.log(`\n✅ ${name} added! Run 'npm run build' to compile.\n`);
}

async function batchAdd(): Promise<void> {
  console.log("\n📦 Batch add services\n");
  console.log("Available:");
  const names = Object.keys(SERVICE_CONFIGS);
  names.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));

  const input = await ask("\nEnter numbers or names (comma-separated), or 'all': ");

  let selected: string[];
  if (input.trim().toLowerCase() === "all") {
    selected = names;
  } else {
    selected = input.split(",").map(s => {
      s = s.trim();
      const num = parseInt(s);
      if (!isNaN(num) && num > 0 && num <= names.length) return names[num - 1];
      return s;
    }).filter(s => SERVICE_CONFIGS[s]);
  }

  if (!selected.length) {
    console.log("No valid services selected.\n");
    return;
  }

  console.log(`\nAdding ${selected.length} services: ${selected.join(", ")}\n`);

  for (const name of selected) {
    await addService(name);
  }

  console.log(`\n🎉 Done! ${selected.length} services added.`);
  console.log("   Run: npm run build && launchctl unload ~/Library/LaunchAgents/com.bit7.server.plist && launchctl load ~/Library/LaunchAgents/com.bit7.server.plist\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--list") || args.includes("-l")) {
    await listAvailable();
  } else if (args.includes("--batch") || args.includes("-b")) {
    await batchAdd();
  } else if (args.length > 0) {
    for (const name of args) {
      if (!name.startsWith("-")) await addService(name);
    }
  } else {
    // Interactive
    await listAvailable();
    const name = await ask("Enter service name to add: ");
    if (name.trim()) await addService(name.trim());
  }

  rl.close();
}

main().catch(console.error);
