import "dotenv/config";
import express from "express";
import cors from "cors";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import searchRouter from "./routes/search.js";
import businessesRouter from "./routes/businesses.js";
import groupsRouter from "./routes/groups.js";
import activityRouter from "./routes/activity.js";
import documentsRouter from "./routes/documents.js";
import campaignsRouter from "./routes/campaigns.js";
import trackingRouter from "./routes/tracking.js";
import authRouter from "./routes/auth.js";
import analyticsRouter from "./routes/analytics.js";
import { requireAuth } from "./auth.js";
import { startFollowUpCron } from "./followUpEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
mkdirSync(join(__dirname, "../../data"), { recursive: true });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Public routes
app.use("/api/auth", authRouter);
app.use("/api/track", trackingRouter);

// Protected routes — require JWT
app.use("/api/search", requireAuth, searchRouter);
app.use("/api/businesses", requireAuth, businessesRouter);
app.use("/api/groups", requireAuth, groupsRouter);
app.use("/api/activity", requireAuth, activityRouter);
app.use("/api/documents", requireAuth, documentsRouter);
app.use("/api/campaigns", requireAuth, campaignsRouter);
app.use("/api/analytics", requireAuth, analyticsRouter);

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// Error handler globale — cattura errori non gestiti nelle route
app.use((err, req, res, _next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Serve frontend static files in production
const distPath = join(__dirname, "../../frontend/dist");
app.use(express.static(distPath));

// Handle React routing, return all requests to React app
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(join(distPath, "index.html"));
  } else {
    res.status(404).json({ error: "API route not found" });
  }
});

app.listen(PORT, () => {
  console.log(`LeadGen.io running on http://localhost:${PORT}`);
  startFollowUpCron();
});
