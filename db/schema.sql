-- FlameGuard Relational Database Schema (SQLite / PostgreSQL compatible)
-- Preserves original NASA measurement units, normalized SI units, provenance, and missing-value metadata.

CREATE TABLE IF NOT EXISTS investigations (
  investigation_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  full_title TEXT NOT NULL,
  description TEXT NOT NULL,
  nasa_source TEXT NOT NULL,
  doi TEXT,
  research_area TEXT NOT NULL,
  principal_investigators TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiments (
  experiment_id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  sample_group TEXT NOT NULL,
  experiment_description TEXT NOT NULL,
  gravity_condition TEXT NOT NULL, -- 'Microgravity' | 'Partial gravity' | 'Normal gravity'
  fuel_type TEXT NOT NULL,         -- 'Solid Polymer' | 'Fabric Composite' | 'Liquid Droplet' | 'Gaseous Jet' | 'Pyrolysis Aerosol'
  material TEXT NOT NULL,
  experimental_date TEXT,
  outcome_label TEXT NOT NULL,     -- 'Sustained Flame' | 'Radiative Extinction' | 'Blow-off Extinction' | 'Diffusive Extinction' | 'Cool Flame Transition' | 'No Ignition' | 'Pyrolysis Smoke'
  sustained_combustion INTEGER,    -- 1 = sustained flame/spread, 0 = extinguished/non-sustained, NULL = non-flaming pyrolysis or incomplete telemetry
  is_demonstration_benchmark INTEGER NOT NULL DEFAULT 0,
  provenance_type TEXT NOT NULL,   -- 'Primary Uploaded NASA Asset' | 'Published NASA NTRS/PSI Benchmark' | 'User Imported Dataset'
  source_url TEXT NOT NULL,
  doi TEXT,
  local_asset_path TEXT,
  data_quality_note TEXT NOT NULL,
  FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id)
);

CREATE TABLE IF NOT EXISTS measurements (
  measurement_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  parameter_name TEXT NOT NULL,
  original_value REAL,
  original_unit TEXT NOT NULL,
  normalized_value REAL,
  normalized_unit TEXT NOT NULL,
  quality_flag TEXT NOT NULL DEFAULT 'verified', -- 'verified' | 'missing_in_source' | 'uncalibrated_telemetry'
  FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id)
);

CREATE TABLE IF NOT EXISTS findings (
  finding_id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  researchers TEXT NOT NULL,
  topic TEXT NOT NULL,
  gravity_condition TEXT NOT NULL,
  scientific_objective TEXT NOT NULL,
  experimental_conditions TEXT NOT NULL,
  observation TEXT NOT NULL,
  important_measurements TEXT NOT NULL,
  researcher_conclusion TEXT NOT NULL,
  ai_interpretation TEXT NOT NULL,
  safety_implication TEXT NOT NULL,
  limitations TEXT NOT NULL,
  citation TEXT NOT NULL,
  source_url TEXT NOT NULL,
  doi TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id)
);

CREATE TABLE IF NOT EXISTS predictions (
  prediction_id TEXT PRIMARY KEY,
  input_conditions TEXT NOT NULL,
  target_outcome TEXT NOT NULL,
  predicted_probability REAL,
  risk_category TEXT NOT NULL,
  model_version TEXT NOT NULL,
  uncertainty TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'ProofSheet PDF' | 'Telemetry Video MP4' | 'PSI Dataset Record' | 'NTRS Technical Paper' | 'User Imported File'
  source_url TEXT NOT NULL,
  doi TEXT,
  local_path TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  FOREIGN KEY (investigation_id) REFERENCES investigations(investigation_id)
);

CREATE TABLE IF NOT EXISTS telemetry_series (
  series_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  timestamp_utc TEXT NOT NULL,
  elapsed_sec REAL NOT NULL,
  fan_telemetry REAL,
  radiometer_value REAL,
  fuel_sensor REAL,
  air_sensor REAL,
  event_note TEXT,
  FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id)
);

CREATE TABLE IF NOT EXISTS datasets_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  topic TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  investigation_id TEXT
);

