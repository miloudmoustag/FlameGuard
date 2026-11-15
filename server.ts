import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { FlameGuardDatabase } from "./server/database.ts";
import { answerResearchQuestion } from "./server/ragEngine.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "8mb" }));

  const fgDb = new FlameGuardDatabase();

  // Health & API endpoints
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", database: "sqlite", ml_ready: true });
  });

  app.get("/api/lessons", (_req, res) => {
    try {
      const lessonsPath = path.resolve(process.cwd(), "data", "flameguard_lessons_learned.json");
      const raw = fs.readFileSync(lessonsPath, "utf-8");
      res.setHeader("Content-Type", "application/json");
      res.send(raw);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load lessons learned dataset" });
    }
  });

  app.get("/api/overview", (_req, res) => {
    try {
      const overview = fgDb.getOverviewStats();
      const mlReport = fgDb.mlEngine.getEvaluationReport();
      res.json({ ...overview, mlReport });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load overview" });
    }
  });

  app.get("/api/investigations", (_req, res) => {
    try {
      res.json({
        investigations: fgDb.getInvestigationsDetail(),
        datasetsRegistry: fgDb.getDatasetsRegistry(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load investigations" });
    }
  });

  app.get("/api/registry", (_req, res) => {
    try {
      res.json({ datasetsRegistry: fgDb.getDatasetsRegistry() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load datasets registry" });
    }
  });

  app.get("/api/experiments", (_req, res) => {
    try {
      const experiments = fgDb.getAllExperimentsWithMeasurements();
      const telemetry = fgDb.db
        .prepare("SELECT * FROM telemetry_series ORDER BY elapsed_sec ASC")
        .all();
      res.json({ experiments, telemetry });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load experiments" });
    }
  });

  app.get("/api/findings", (_req, res) => {
    try {
      res.json({ findings: fgDb.getFindings() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load findings" });
    }
  });

  app.get("/api/documents", (_req, res) => {
    try {
      res.json({ documents: fgDb.getDocuments() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load documents" });
    }
  });

  app.get("/api/ml/evaluation", (_req, res) => {
    try {
      const report = fgDb.mlEngine.getEvaluationReport();
      const recentPredictions = fgDb.getRecentPredictions();
      res.json({ evaluation: report, recentPredictions });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load ML evaluation" });
    }
  });

  app.post("/api/ml/predict", (req, res) => {
    try {
      const {
        gravity_condition = "Microgravity",
        oxygen_pct = 21,
        temperature_c = 22,
        pressure_kpa = 101.3,
        flow_velocity_cm_s = 10,
        fuel_type = "Solid Polymer",
        material = "PMMA (Acrylic)",
        save = true,
      } = req.body || {};

      const o2 = Number(oxygen_pct);
      const temp = Number(temperature_c);
      const press = Number(pressure_kpa);
      const flow = Number(flow_velocity_cm_s);

      if ([o2, temp, press, flow].some((v) => Number.isNaN(v))) {
        return res.status(400).json({ error: "Numeric input parameters are invalid." });
      }

      const result = fgDb.mlEngine.predict({
        gravity_condition,
        oxygen_pct: o2,
        temperature_c: temp,
        pressure_kpa: press,
        flow_velocity_cm_s: flow,
        fuel_type,
        material,
      });

      if (save) {
        fgDb.savePrediction({
          prediction_id: `PRED-${Date.now()}`,
          input_conditions: JSON.stringify({
            gravity_condition,
            oxygen_pct: o2,
            temperature_c: temp,
            pressure_kpa: press,
            flow_velocity_cm_s: flow,
            fuel_type,
            material,
          }),
          target_outcome: result.target_outcome,
          predicted_probability: result.ensemble_probability,
          risk_category: result.risk_category,
          model_version: result.model_version,
          uncertainty: result.uncertainty_interval
            ? `${(result.uncertainty_interval[0] * 100).toFixed(1)}%–${(result.uncertainty_interval[1] * 100).toFixed(1)}%`
            : "Outside training range",
          explanation: result.explanation,
        });
      }

      res.json({ prediction: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Prediction failed" });
    }
  });

  app.post("/api/data/import", (req, res) => {
    try {
      const { title, investigation_id, file_format, source_url, records } = req.body || {};
      if (!title || !investigation_id || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: "Provide title, investigation_id, and at least one parsed record." });
      }
      const result = fgDb.importUserDataset({
        title,
        investigation_id,
        file_format: file_format || "CSV",
        source_url: source_url || "https://psi.nasa.gov",
        records,
      });
      res.json({
        ...result,
        ml_evaluation: fgDb.mlEngine.getEvaluationReport(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Dataset import failed" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { question, history } = req.body || {};
      if (!question || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ error: "Question is required." });
      }
      const reply = await answerResearchQuestion(fgDb, question.trim(), Array.isArray(history) ? history : []);
      res.json(reply);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Chat query failed" });
    }
  });

  // Vite middleware for dev, static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FlameGuard server running on http://localhost:${PORT}`);
  });
}

startServer();
