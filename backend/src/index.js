import "dotenv/config";
import express from "express";
import cors from "cors";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import searchRouter from "./routes/search.js";
import businessesRouter from "./routes/businesses.js";
import groupsRouter from "./routes/groups.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
mkdirSync(join(__dirname, "../../data"), { recursive: true });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use("/api/search", searchRouter);
app.use("/api/businesses", businessesRouter);
app.use("/api/groups", groupsRouter);

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

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
  console.log(`✅ LeadGen.io running on http://localhost:${PORT}`);
});
