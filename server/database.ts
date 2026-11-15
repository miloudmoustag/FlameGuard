import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  DOCUMENTS_SEED,
  EXPERIMENTS_SEED,
  FINDINGS_SEED,
  INVESTIGATIONS_SEED,
  TELEMETRY_SERIES_SEED,
} from "./nasaSeedData.ts";
import { FlameGuardMLEngine, LabeledTrainingRecord } from "./mlEngine.ts";

const DB_PATH = path.resolve(process.cwd(), "db", "flameguard.sqlite");
const SCHEMA_PATH = path.resolve(process.cwd(), "db", "schema.sql");

export class FlameGuardDatabase {
  public db: Database.Database;
  public mlEngine!: FlameGuardMLEngine;

  constructor() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
    this.syncSeedData();
    this.retrainMLModel();
  }

  private initSchema() {
    const sql = fs.readFileSync(SCHEMA_PATH, "utf-8");
    this.db.exec(sql);
  }

  private syncSeedData() {
    const insertInv = this.db.prepare(`
      INSERT OR IGNORE INTO investigations (
        investigation_id, name, full_title, description, nasa_source, doi,
        research_area, principal_investigators, platform, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertExp = this.db.prepare(`
      INSERT OR IGNORE INTO experiments (
        experiment_id, investigation_id, sample_group, experiment_description,
        gravity_condition, fuel_type, material, experimental_date, outcome_label,
        sustained_combustion, is_demonstration_benchmark, provenance_type,
        source_url, doi, local_asset_path, data_quality_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMeas = this.db.prepare(`
      INSERT OR IGNORE INTO measurements (
        measurement_id, experiment_id, parameter_name, original_value,
        original_unit, normalized_value, normalized_unit, quality_flag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFind = this.db.prepare(`
      INSERT OR IGNORE INTO findings (
        finding_id, investigation_id, title, researchers, topic, gravity_condition,
        scientific_objective, experimental_conditions, observation, important_measurements,
        researcher_conclusion, ai_interpretation, safety_implication, limitations,
        citation, source_url, doi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertDoc = this.db.prepare(`
      INSERT OR IGNORE INTO documents (
        document_id, investigation_id, title, document_type, source_url,
        doi, local_path, record_count, processing_status, extracted_text, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTel = this.db.prepare(`
      INSERT OR IGNORE INTO telemetry_series (
        series_id, experiment_id, timestamp_utc, elapsed_sec, fan_telemetry,
        radiometer_value, fuel_sensor, air_sensor, event_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRegistry = this.db.prepare(`
      INSERT OR REPLACE INTO datasets_registry (
        id, name, platform, topic, source, status, investigation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const COMPACT_SEED_PATH = path.resolve(
      process.cwd(),
      "public",
      "assets",
      "aistudio",
      "flameguard_compact_seed_03ed9310.json"
    );

    const REGISTRY_INV_MAP: Record<string, string> = {
      "BASS": "NASA-BASS",
      "BASS-II": "PSI-25-BASS-II",
      "FLEX": "PSI-69-FLEX",
      "SAFFIRE-I/II/III": "NASA-SAFFIRE",
      "SPICE": "PSI-60-SPICE",
      "SAME": "PSI-SAME",
      "FLEX-2": "PSI-FLEX-2",
      "CFI": "PSI-CFI",
      "ACME-sFlames": "PSI-ACME-SFLAMES",
      "ACME-BRE": "PSI-ACME-BRE",
      "ACME-CLD": "PSI-ACME-CLD",
      "ACME-EField": "PSI-ACME-EFIELD",
      "DAFT/DAFT-2": "PSI-DAFT",
      "SLICE": "PSI-SLICE",
      "SIBAL": "NASA-SIBAL",
    };

    const txn = this.db.transaction(() => {
      for (const inv of INVESTIGATIONS_SEED) {
        insertInv.run(
          inv.investigation_id,
          inv.name,
          inv.full_title,
          inv.description,
          inv.nasa_source,
          inv.doi,
          inv.research_area,
          inv.principal_investigators,
          inv.platform,
          inv.status
        );
      }

      if (fs.existsSync(COMPACT_SEED_PATH)) {
        try {
          const compactRaw = JSON.parse(fs.readFileSync(COMPACT_SEED_PATH, "utf-8"));
          if (Array.isArray(compactRaw.datasets_registry)) {
            for (const reg of compactRaw.datasets_registry) {
              insertRegistry.run(
                reg.id,
                reg.name,
                reg.platform,
                reg.topic,
                reg.source,
                reg.status,
                REGISTRY_INV_MAP[reg.id] ?? null
              );
            }
          }
        } catch (err) {
          console.warn("Could not parse compact seed registry:", err);
        }
      }

      for (const exp of EXPERIMENTS_SEED) {
        insertExp.run(
          exp.experiment_id,
          exp.investigation_id,
          exp.sample_group,
          exp.experiment_description,
          exp.gravity_condition,
          exp.fuel_type,
          exp.material,
          exp.experimental_date,
          exp.outcome_label,
          exp.sustained_combustion,
          exp.is_demonstration_benchmark,
          exp.provenance_type,
          exp.source_url,
          exp.doi,
          exp.local_asset_path,
          exp.data_quality_note
        );

        exp.measurements.forEach((meas, idx) => {
          insertMeas.run(
            `${exp.experiment_id}-M${idx + 1}`,
            exp.experiment_id,
            meas.parameter_name,
            meas.original_value,
            meas.original_unit,
            meas.normalized_value,
            meas.normalized_unit,
            meas.quality_flag
          );
        });
      }

      for (const f of FINDINGS_SEED) {
        insertFind.run(
          f.finding_id,
          f.investigation_id,
          f.title,
          f.researchers,
          f.topic,
          f.gravity_condition,
          f.scientific_objective,
          f.experimental_conditions,
          f.observation,
          f.important_measurements,
          f.researcher_conclusion,
          f.ai_interpretation,
          f.safety_implication,
          f.limitations,
          f.citation,
          f.source_url,
          f.doi
        );
      }

      for (const doc of DOCUMENTS_SEED) {
        insertDoc.run(
          doc.document_id,
          doc.investigation_id,
          doc.title,
          doc.document_type,
          doc.source_url,
          doc.doi,
          doc.local_path,
          doc.record_count,
          doc.processing_status,
          doc.extracted_text,
          doc.imported_at
        );
      }

      TELEMETRY_SERIES_SEED.forEach((pt, idx) => {
        insertTel.run(
          `TEL-S147-${idx + 1}`,
          pt.experiment_id,
          pt.timestamp_utc,
          pt.elapsed_sec,
          pt.fan_telemetry,
          pt.radiometer_value,
          pt.fuel_sensor,
          pt.air_sensor,
          pt.event_note
        );
      });
    });

    txn();
  }

  public getLabeledTrainingRecords(): LabeledTrainingRecord[] {
    const experiments = this.db
      .prepare(
        `SELECT experiment_id, investigation_id, sample_group, material, fuel_type,
                gravity_condition, outcome_label, sustained_combustion
         FROM experiments
         WHERE sustained_combustion IS NOT NULL`
      )
      .all() as any[];

    const measStmt = this.db.prepare(
      `SELECT parameter_name, normalized_value FROM measurements
       WHERE experiment_id = ? AND quality_flag = 'verified' AND normalized_value IS NOT NULL`
    );

    const records: LabeledTrainingRecord[] = [];
    for (const exp of experiments) {
      const measRows = measStmt.all(exp.experiment_id) as { parameter_name: string; normalized_value: number }[];
      const map = new Map(measRows.map((m) => [m.parameter_name, m.normalized_value]));

      const o2 = map.get("oxygen_concentration");
      const flow = map.get("flow_velocity");
      const press = map.get("pressure");
      const tempK = map.get("temperature") ?? 295.15;

      if (o2 !== undefined && flow !== undefined && press !== undefined) {
        records.push({
          ...exp,
          oxygen_pct: o2,
          flow_velocity_cm_s: flow,
          pressure_kpa: press,
          temperature_k: tempK,
        });
      }
    }
    return records;
  }

  public retrainMLModel() {
    const totalExp = (this.db.prepare("SELECT COUNT(*) as cnt FROM experiments").get() as { cnt: number }).cnt;
    const labeled = this.getLabeledTrainingRecords();
    this.mlEngine = new FlameGuardMLEngine(labeled, totalExp);
  }

  public getOverviewStats() {
    const invCount = (this.db.prepare("SELECT COUNT(*) as cnt FROM investigations").get() as { cnt: number }).cnt;
    const expCount = (this.db.prepare("SELECT COUNT(*) as cnt FROM experiments").get() as { cnt: number }).cnt;
    const obsCount = (
      this.db.prepare("SELECT COUNT(*) as cnt FROM measurements WHERE normalized_value IS NOT NULL").get() as {
        cnt: number;
      }
    ).cnt;
    const missingObsCount = (
      this.db.prepare("SELECT COUNT(*) as cnt FROM measurements WHERE normalized_value IS NULL").get() as {
        cnt: number;
      }
    ).cnt;
    const findCount = (this.db.prepare("SELECT COUNT(*) as cnt FROM findings").get() as { cnt: number }).cnt;
    const docCount = (this.db.prepare("SELECT COUNT(*) as cnt FROM documents").get() as { cnt: number }).cnt;
    const trainingRecordsCount = this.mlEngine.getEvaluationReport().training_records_count;
    const datasetsRegistry = this.getDatasetsRegistry();

    const byInvestigation = this.db
      .prepare(
        `SELECT i.name as name, i.investigation_id, COUNT(e.experiment_id) as experiments
         FROM investigations i
         LEFT JOIN experiments e ON i.investigation_id = e.investigation_id
         GROUP BY i.investigation_id
         ORDER BY experiments DESC`
      )
      .all();

    const byGravity = this.db
      .prepare(
        `SELECT gravity_condition as name, COUNT(*) as value
         FROM experiments
         GROUP BY gravity_condition`
      )
      .all();

    const byFuel = this.db
      .prepare(
        `SELECT fuel_type as name, COUNT(*) as count
         FROM experiments
         GROUP BY fuel_type
         ORDER BY count DESC`
      )
      .all();

    const byOutcome = this.db
      .prepare(
        `SELECT outcome_label as name, COUNT(*) as count
         FROM experiments
         GROUP BY outcome_label
         ORDER BY count DESC`
      )
      .all();

    const topParameters = this.db
      .prepare(
        `SELECT parameter_name as name, COUNT(*) as count,
                SUM(CASE WHEN quality_flag = 'verified' THEN 1 ELSE 0 END) as verified_count
         FROM measurements
         GROUP BY parameter_name
         ORDER BY verified_count DESC`
      )
      .all();

    const oxygenDist = this.db
      .prepare(
        `SELECT
          CASE
            WHEN normalized_value < 15 THEN '< 15% O2'
            WHEN normalized_value >= 15 AND normalized_value < 20 THEN '15–19.9% O2'
            WHEN normalized_value >= 20 AND normalized_value <= 22.5 THEN '20–22.5% O2'
            ELSE '> 22.5% O2'
          END as bin,
          COUNT(*) as count
         FROM measurements
         WHERE parameter_name = 'oxygen_concentration' AND normalized_value IS NOT NULL
         GROUP BY bin`
      )
      .all();

    const recentInvestigations = this.db
      .prepare(
        `SELECT i.*, COUNT(e.experiment_id) as experiment_count,
                (SELECT COUNT(*) FROM findings f WHERE f.investigation_id = i.investigation_id) as finding_count
         FROM investigations i
         LEFT JOIN experiments e ON i.investigation_id = e.investigation_id
         GROUP BY i.investigation_id`
      )
      .all();

    const s147Telemetry = this.db
      .prepare(`SELECT * FROM telemetry_series WHERE experiment_id = 'BASS2-GMT050-S147-B1' ORDER BY elapsed_sec ASC`)
      .all();

    return {
      kpis: {
        investigations: invCount,
        experiments: expCount,
        observations: obsCount,
        missing_observations: missingObsCount,
        findings: findCount,
        documents: docCount,
        training_records_count: trainingRecordsCount,
        validated_prediction_records: trainingRecordsCount,
      },
      charts: {
        byInvestigation,
        byGravity,
        byFuel,
        byOutcome,
        topParameters,
        oxygenDist,
      },
      recentInvestigations,
      datasetsRegistry,
      s147Telemetry,
    };
  }

  public getDatasetsRegistry() {
    return this.db
      .prepare(
        `SELECT r.*,
                COUNT(e.experiment_id) as experiment_count,
                (SELECT COUNT(*) FROM findings f WHERE f.investigation_id = r.investigation_id) as finding_count
         FROM datasets_registry r
         LEFT JOIN experiments e ON r.investigation_id = e.investigation_id
         GROUP BY r.id`
      )
      .all();
  }

  public getAllExperimentsWithMeasurements() {
    const exps = this.db
      .prepare(
        `SELECT e.*, i.name as investigation_name
         FROM experiments e
         JOIN investigations i ON e.investigation_id = i.investigation_id
         ORDER BY e.provenance_type ASC, e.experimental_date DESC`
      )
      .all() as any[];

    const measStmt = this.db.prepare(`SELECT * FROM measurements WHERE experiment_id = ?`);
    return exps.map((e) => {
      const meas = measStmt.all(e.experiment_id) as any[];
      const metrics: Record<string, { value: number | null; unit: string; flag: string }> = {};
      for (const m of meas) {
        metrics[m.parameter_name] = {
          value: m.normalized_value,
          unit: m.normalized_unit,
          flag: m.quality_flag,
        };
      }
      return { ...e, measurements: meas, metrics };
    });
  }

  public getInvestigationsDetail() {
    const invs = this.db.prepare("SELECT * FROM investigations").all() as any[];
    const exps = this.getAllExperimentsWithMeasurements();
    const finds = this.db.prepare("SELECT * FROM findings").all() as any[];
    const docs = this.db.prepare("SELECT * FROM documents").all() as any[];

    return invs.map((inv) => ({
      ...inv,
      experiments: exps.filter((e) => e.investigation_id === inv.investigation_id),
      findings: finds.filter((f) => f.investigation_id === inv.investigation_id),
      documents: docs.filter((d) => d.investigation_id === inv.investigation_id),
    }));
  }

  public getFindings() {
    return this.db
      .prepare(
        `SELECT f.*, i.name as investigation_name, i.full_title as investigation_full_title
         FROM findings f
         JOIN investigations i ON f.investigation_id = i.investigation_id`
      )
      .all();
  }

  public getDocuments() {
    return this.db
      .prepare(
        `SELECT d.*, i.name as investigation_name
         FROM documents d
         JOIN investigations i ON d.investigation_id = i.investigation_id
         ORDER BY d.imported_at DESC`
      )
      .all();
  }

  public savePrediction(record: {
    prediction_id: string;
    input_conditions: string;
    target_outcome: string;
    predicted_probability: number | null;
    risk_category: string;
    model_version: string;
    uncertainty: string;
    explanation: string;
  }) {
    this.db
      .prepare(
        `INSERT INTO predictions (
          prediction_id, input_conditions, target_outcome, predicted_probability,
          risk_category, model_version, uncertainty, explanation, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.prediction_id,
        record.input_conditions,
        record.target_outcome,
        record.predicted_probability,
        record.risk_category,
        record.model_version,
        record.uncertainty,
        record.explanation,
        new Date().toISOString()
      );
  }

  public getRecentPredictions() {
    return this.db.prepare(`SELECT * FROM predictions ORDER BY created_at DESC LIMIT 20`).all();
  }

  public importUserDataset(payload: {
    title: string;
    investigation_id: string;
    file_format: string;
    source_url: string;
    records: Array<{
      experiment_id?: string;
      sample_group?: string;
      description?: string;
      gravity_condition?: string;
      fuel_type?: string;
      material?: string;
      experimental_date?: string;
      outcome_label?: string;
      sustained_combustion?: number | null;
      oxygen_pct?: number | null;
      flow_velocity_cm_s?: number | null;
      pressure_kpa?: number | null;
      temperature_c?: number | null;
    }>;
  }) {
    const docId = `DOC-USER-${Date.now()}`;
    const validGravity = (g?: string) =>
      g === "Partial gravity" || g === "Normal gravity" ? g : "Microgravity";

    const insertExp = this.db.prepare(`
      INSERT OR REPLACE INTO experiments (
        experiment_id, investigation_id, sample_group, experiment_description,
        gravity_condition, fuel_type, material, experimental_date, outcome_label,
        sustained_combustion, is_demonstration_benchmark, provenance_type,
        source_url, doi, local_asset_path, data_quality_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMeas = this.db.prepare(`
      INSERT OR REPLACE INTO measurements (
        measurement_id, experiment_id, parameter_name, original_value,
        original_unit, normalized_value, normalized_unit, quality_flag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertedCount = 0;
    const txn = this.db.transaction(() => {
      payload.records.forEach((rec, idx) => {
        const expId = rec.experiment_id?.trim() || `USR-${Date.now()}-${idx + 1}`;
        const grav = validGravity(rec.gravity_condition);
        const sustained =
          rec.sustained_combustion === 0 || rec.sustained_combustion === 1 ? rec.sustained_combustion : null;

        insertExp.run(
          expId,
          payload.investigation_id,
          rec.sample_group || `${payload.investigation_id}-IMPORT`,
          rec.description || `User-imported NASA PSI record (${payload.title})`,
          grav,
          rec.fuel_type || "Solid Polymer",
          rec.material || "Unspecified",
          rec.experimental_date || new Date().toISOString().slice(0, 10),
          rec.outcome_label || (sustained === 1 ? "Sustained Flame" : sustained === 0 ? "Extinction" : "Observed"),
          sustained,
          0,
          "User Imported Dataset",
          payload.source_url || "https://psi.nasa.gov",
          null,
          null,
          `Imported via FlameGuard Data Pipeline (${payload.file_format}); missing numeric values preserved as NULL without imputation.`
        );

        const pushMeas = (name: string, val: number | null | undefined, unit: string, normVal: number | null, normUnit: string) => {
          const isPresent = val !== null && val !== undefined && !Number.isNaN(Number(val));
          insertMeas.run(
            `${expId}-${name}`,
            expId,
            name,
            isPresent ? Number(val) : null,
            unit,
            isPresent ? normVal : null,
            normUnit,
            isPresent ? "verified" : "missing_in_source"
          );
        };

        pushMeas("oxygen_concentration", rec.oxygen_pct, "% vol", rec.oxygen_pct ?? null, "% vol");
        pushMeas("flow_velocity", rec.flow_velocity_cm_s, "cm/s", rec.flow_velocity_cm_s ?? null, "cm/s");
        pushMeas("pressure", rec.pressure_kpa, "kPa", rec.pressure_kpa ?? null, "kPa");
        if (rec.temperature_c !== null && rec.temperature_c !== undefined && !Number.isNaN(Number(rec.temperature_c))) {
          pushMeas("temperature", rec.temperature_c, "°C", Number(rec.temperature_c) + 273.15, "K");
        }
        insertedCount++;
      });

      this.db
        .prepare(
          `INSERT INTO documents (
            document_id, investigation_id, title, document_type, source_url,
            doi, local_path, record_count, processing_status, extracted_text, imported_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          docId,
          payload.investigation_id,
          payload.title,
          `User Imported File (${payload.file_format})`,
          payload.source_url || "https://psi.nasa.gov",
          null,
          null,
          insertedCount,
          `Ingested & Normalized (${insertedCount} records)`,
          `User-imported dataset '${payload.title}' containing ${insertedCount} records mapped to ${payload.investigation_id}.`,
          new Date().toISOString()
        );
    });

    txn();
    this.retrainMLModel();
    return { document_id: docId, imported_records: insertedCount };
  }
}
