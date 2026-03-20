import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./lib/db.js";
import { agentsRouter } from "./routes/agents.js";
import { smsRouter } from "./routes/sms.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));
app.set("trust proxy", 1);

// API routes
app.use("/api/agents", agentsRouter);
app.use("/api/sms", smsRouter);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, service: "bit7-api", db: "connected" });
  } catch {
    return res.status(503).json({ ok: false, service: "bit7-api", db: "disconnected" });
  }
});

// Serve React frontend
app.use(express.static(publicDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`bit7 API running on http://localhost:${port}`);
});
