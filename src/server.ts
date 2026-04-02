import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "./lib/db.js";
import { generateRouter } from "./routes/generate.js";
import { agentsRouter } from "./routes/agents.js";
import { shareRouter } from "./routes/share.js";
import { chatRouter } from "./routes/chat.js";
import { clarifyRouter } from "./routes/clarify.js";
import { analyticsRouter } from "./routes/analytics.js";
import { webhookRouter } from "./routes/webhook.js";
import { oauthRouter } from "./routes/oauth.js";
import icloudAuthRouter from "./routes/icloudAuth.js";
import shortcutSyncRouter from "./routes/shortcutSync.js";
import setupRouter from "./routes/setup.js";
import { blindDateRouter } from "./routes/blindDate.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false })); // Twilio sends form-urlencoded
app.set("trust proxy", 1);

// API routes
app.use("/api/generate", generateRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/agents", chatRouter);
app.use("/api/clarify", clarifyRouter);
app.use("/api/share", shareRouter);
app.use("/api/agents", analyticsRouter);

app.use("/api/webhook", webhookRouter);
app.use("/oauth", oauthRouter);
app.use("/api/icloud", icloudAuthRouter);
app.use("/api/sync", shortcutSyncRouter);
app.use("/setup", setupRouter);
app.use("/api/blind-date", blindDateRouter);

// Serve frontend static files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, service: "bit7-api", db: "connected" });
  } catch {
    return res.status(503).json({ ok: false, service: "bit7-api", db: "disconnected" });
  }
});

// SPA fallback — serve index.html for client-side routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, async () => {
  console.log(`Bit7 Agent API running on http://localhost:${port}`);

  // Start iMessage runtime + scheduler if configured
  if (process.env.IMESSAGE_AGENT_ID) {
    try {
      const { startIMessageRuntime } = await import("./lib/imessage/imessageRuntime.js");
      await startIMessageRuntime();

      // Start the scheduler for proactive jobs + live activity subscriptions
      const { startScheduler } = await import("./lib/imessage/scheduler.js");
      await startScheduler();
      console.log("[Scheduler] Proactive intelligence and live tracking active");
    } catch (e) {
      console.warn("[iMessage] Failed to start iMessage runtime:", e instanceof Error ? e.message : e);
      console.warn("[iMessage] This is expected on non-macOS systems or without Full Disk Access");
    }
  }
});
