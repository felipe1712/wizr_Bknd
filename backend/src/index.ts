import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes";
import projectsRoutes from "./routes/projects.routes";
import {
  handleTableQuery,
  handleRpc,
  handleStorageUpload,
  handleStorageRemove,
  handleStorageSignedUrl,
  handleStorageGetFile,
} from "./controllers/db.controller";
import { invokeFunction } from "./controllers/functions.controller";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 1. Auth & Projects REST routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectsRoutes);

// 2. Universal Database Query Adapter, RPC & Storage (Wizr + Portal Ejecutivo)
app.post("/api/db/:table", handleTableQuery);
app.post("/api/rpc/:fnName", handleRpc);
app.post("/api/storage/:bucket/upload", handleStorageUpload);
app.post("/api/storage/:bucket/remove", handleStorageRemove);
app.post("/api/storage/:bucket/signed-url", handleStorageSignedUrl);
app.get("/api/storage/:bucket/file/:filePath", handleStorageGetFile);

// 3. Native Connectors & AI Functions (Apify, BrightData, YouTube, Firecrawl, Metricool, FanpageKarma, AI)
app.post("/api/functions/:functionName", invokeFunction);

// Direct aliases for Firecrawl client compatibility
app.post("/api/firecrawl/search", (req, res) => {
  (req.params as Record<string, string>).functionName = "firecrawl-search";
  return invokeFunction(req, res);
});
app.post("/api/firecrawl/scrape", (req, res) => {
  (req.params as Record<string, string>).functionName = "firecrawl-scrape";
  return invokeFunction(req, res);
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Wizr & KiMedia Portal Unified API is running" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
