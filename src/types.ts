export type PageId =
  | "story"
  | "explore"
  | "compare"
  | "prediction"
  | "ask"
  | "library"
  | "lessons"
  | "report"
  | "limits";

export interface DatasetRegistryEntry {
  id: string;
  name: string;
  platform: string;
  topic: string;
  source: string;
  status: "existing" | "NEW" | string;
  investigation_id: string | null;
  experiment_count: number;
  finding_count: number;
}

export interface MeasurementRecord {
  measurement_id: string;
  experiment_id: string;
  parameter_name: string;
  original_value: number | null;
  original_unit: string;
  normalized_value: number | null;
  normalized_unit: string;
  quality_flag: "verified" | "missing_in_source" | "uncalibrated_telemetry";
}

export interface ExperimentRecord {
  experiment_id: string;
  investigation_id: string;
  investigation_name: string;
  sample_group: string;
  experiment_description: string;
  gravity_condition: "Microgravity" | "Partial gravity" | "Normal gravity";
  fuel_type: string;
  material: string;
  experimental_date: string;
  outcome_label: string;
  sustained_combustion: number | null;
  is_demonstration_benchmark: number;
  provenance_type: string;
  source_url: string;
  doi: string | null;
  local_asset_path: string | null;
  data_quality_note: string;
  measurements: MeasurementRecord[];
  metrics: Record<string, { value: number | null; unit: string; flag: string }>;
}

export interface FindingRecord {
  finding_id: string;
  investigation_id: string;
  investigation_name: string;
  investigation_full_title: string;
  title: string;
  researchers: string;
  topic: string;
  gravity_condition: string;
  scientific_objective: string;
  experimental_conditions: string;
  observation: string;
  important_measurements: string;
  researcher_conclusion: string;
  ai_interpretation: string;
  safety_implication: string;
  limitations: string;
  citation: string;
  source_url: string;
  doi: string | null;
}

export interface DocumentRecord {
  document_id: string;
  investigation_id: string;
  investigation_name: string;
  title: string;
  document_type: string;
  source_url: string;
  doi: string | null;
  local_path: string | null;
  record_count: number;
  processing_status: string;
  extracted_text: string;
  imported_at: string;
}

export interface InvestigationDetail {
  investigation_id: string;
  name: string;
  full_title: string;
  description: string;
  nasa_source: string;
  doi: string | null;
  research_area: string;
  principal_investigators: string;
  platform: string;
  status: string;
  experiments: ExperimentRecord[];
  findings: FindingRecord[];
  documents: DocumentRecord[];
}

export interface TelemetryPoint {
  series_id: string;
  experiment_id: string;
  timestamp_utc: string;
  elapsed_sec: number;
  fan_telemetry: number;
  radiometer_value: number;
  fuel_sensor: number;
  air_sensor: number;
  event_note: string | null;
}

export interface ModelMetrics {
  model_name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number;
  brier_score: number;
}

export interface TrainingRanges {
  oxygen_pct: [number, number];
  flow_velocity_cm_s: [number, number];
  pressure_kpa: [number, number];
}

export interface OutOfRangeDetail {
  parameter: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
}

export interface ModelEvaluationReport {
  target_outcome: string;
  scope_notice: string;
  total_experiments_in_db: number;
  training_records_count: number;
  validated_training_records: number;
  excluded_records_missing_or_nonflaming: number;
  positive_class_count: number;
  negative_class_count: number;
  cv_strategy: string;
  unique_sample_groups: number;
  training_ranges: TrainingRanges;
  logistic_regression: ModelMetrics;
  random_forest: ModelMetrics;
  feature_importances: {
    feature: string;
    label: string;
    logistic_abs_weight: number;
    forest_permutation_importance: number;
  }[];
  boundary_curve?: {
    flow_cm_s: number;
    critical_o2_pct: number;
  }[];
  limitations: string[];
}

export interface PredictionOutput {
  target_outcome: string;
  scope_notice: string;
  out_of_range: boolean;
  out_of_range_details: OutOfRangeDetail[];
  training_ranges: TrainingRanges;
  logistic_probability: number | null;
  forest_probability: number | null;
  ensemble_probability: number | null;
  risk_category: "Low" | "Moderate" | "High" | "Out of Range";
  uncertainty_interval: [number, number] | null;
  model_version: string;
  prototype_notice: string;
  contributions: {
    feature: string;
    label: string;
    input_value: string;
    contribution: number;
    importance: number;
  }[];
  similar_experiments: {
    experiment_id: string;
    investigation_id: string;
    material: string;
    gravity_condition: string;
    oxygen_pct: number;
    flow_velocity_cm_s: number;
    pressure_kpa: number;
    outcome_label: string;
    sustained_combustion: number;
    distance: number;
    similarity_score: number;
  }[];
  explanation: string;
}

export interface OverviewData {
  kpis: {
    investigations: number;
    experiments: number;
    observations: number;
    missing_observations: number;
    findings: number;
    documents: number;
    training_records_count: number;
    validated_prediction_records: number;
  };
  charts: {
    byInvestigation: { name: string; investigation_id: string; experiments: number }[];
    byGravity: { name: string; value: number }[];
    byFuel: { name: string; count: number }[];
    byOutcome: { name: string; count: number }[];
    topParameters: { name: string; count: number; verified_count: number }[];
    oxygenDist: { bin: string; count: number }[];
  };
  recentInvestigations: any[];
  datasetsRegistry: DatasetRegistryEntry[];
  s147Telemetry: TelemetryPoint[];
  mlReport: ModelEvaluationReport;
}

export type LessonSourceQuality = "NASA" | "secondary";

export interface LessonFact {
  fact: string;
  source: string;
  source_quality: LessonSourceQuality | string;
}

export interface LessonIncidentEnvironment {
  atmosphere?: string;
  pressure_psi?: number;
  pressure_kpa?: number;
  location?: string;
  medium?: string;
  microgravity_relevance?: string;
  crew?: number;
}

export interface LessonIncident {
  id: string;
  date: string;
  type: string;
  environment: LessonIncidentEnvironment;
  facts: LessonFact[];
  changes_made?: string[];
  changes_source?: string[];
  scope_context?: string;
}

export interface IssFireSafetyHardware {
  item: string;
  source: string;
}

export interface MicrogravityFireScienceLink {
  link: string;
  source: string;
}

export interface DesignTakeawayItem {
  id: string;
  takeaway: string;
  evidence: string[];
}

export interface DesignTakeaways {
  label: string;
  items: DesignTakeawayItem[];
}

export interface AdditionalDatasetCandidate {
  id: string;
  name: string;
  topic: string;
  source: string;
  data_status: string;
}

export interface LessonsMeta {
  name: string;
  generated: string;
  integrity_rule: string;
  warning: string;
}

export interface LessonsLearnedData {
  _meta: LessonsMeta;
  incidents: LessonIncident[];
  iss_fire_safety_hardware: IssFireSafetyHardware[];
  microgravity_fire_science_links: MicrogravityFireScienceLink[];
  design_takeaways: DesignTakeaways;
  additional_dataset_candidates: AdditionalDatasetCandidate[];
  data_gaps: string[];
}


