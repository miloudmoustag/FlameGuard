export interface LabeledTrainingRecord {
  experiment_id: string;
  investigation_id: string;
  sample_group: string;
  material: string;
  fuel_type: string;
  gravity_condition: string;
  outcome_label: string;
  sustained_combustion: number; // 1 = sustained, 0 = extinguished/no-ignition
  oxygen_pct: number;
  flow_velocity_cm_s: number;
  pressure_kpa: number;
  temperature_k: number;
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

export interface FeatureContribution {
  feature: string;
  label: string;
  input_value: string;
  contribution: number; // positive increases fire sustainability probability
  importance: number;
}

export interface SimilarExperiment {
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
  contributions: FeatureContribution[];
  similar_experiments: SimilarExperiment[];
  explanation: string;
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
  feature_importances: { feature: string; label: string; logistic_abs_weight: number; forest_permutation_importance: number }[];
  boundary_curve: { flow_cm_s: number; critical_o2_pct: number }[];
  limitations: string[];
}

interface FeatureRow {
  x: number[];
  y: number;
  group: string;
  record: LabeledTrainingRecord;
}

const FEATURE_NAMES = [
  "oxygen_pct",
  "pp_o2_kpa",
  "log_flow_velocity",
  "low_flow_quench",
  "o2_flow_margin",
  "gravity_num",
  "is_flame_retardant",
  "is_liquid_or_gas",
];

const FEATURE_LABELS: Record<string, string> = {
  oxygen_pct: "Oxygen Concentration (% vol)",
  pp_o2_kpa: "O2 Partial Pressure (kPa)",
  log_flow_velocity: "Log Airflow Velocity ln(1+v)",
  low_flow_quench: "Low-Flow Quench (<2.5 cm/s in 0g)",
  o2_flow_margin: "O2 × Flow Flammability Margin",
  gravity_num: "Gravity Acceleration (g)",
  is_flame_retardant: "Flame-Retardant Material (Nomex)",
  is_liquid_or_gas: "Volatile Liquid / Gas Fuel",
};

function encodeGravity(g: string): number {
  if (g === "Microgravity") return 0.0;
  if (g === "Partial gravity") return 0.27;
  return 1.0;
}

function isFlameRetardantMaterial(material: string): number {
  const m = material.toLowerCase();
  return m.includes("nomex") || m.includes("teflon") || m.includes("kapton") ? 1 : 0;
}

function isVolatileFuel(fuelType: string): number {
  const f = fuelType.toLowerCase();
  return f.includes("liquid") || f.includes("gas") ? 1 : 0;
}

function buildFeatureVector(
  oxygen_pct: number,
  flow_velocity_cm_s: number,
  pressure_kpa: number,
  gravity_condition: string,
  material: string,
  fuel_type: string
): number[] {
  const g = encodeGravity(gravity_condition);
  // NASA F9: O2 concentration & partial pressure both influence flammability
  const ppO2 = (oxygen_pct / 100.0) * pressure_kpa;
  // NASA F3/F6: non-linear flow velocity effect; <2.5 cm/s in 0g risks radiative quenching unless O2 is elevated
  const logFlow = Math.log1p(Math.max(0, flow_velocity_cm_s));
  const lowFlowQuench = g < 0.5 && flow_velocity_cm_s < 2.5 ? 1.0 : 0.0;
  // NASA F3/F10: joint O2-flow flammability margin (peaks in moderate forced flow, penalized at blow-off >35 cm/s)
  const effectiveFlow = flow_velocity_cm_s > 35 ? Math.max(0, 35 - (flow_velocity_cm_s - 35) * 0.8) : flow_velocity_cm_s;
  const o2FlowMargin = (oxygen_pct / 21.0) * Math.log1p(Math.max(0, effectiveFlow));

  return [
    oxygen_pct,
    ppO2,
    logFlow,
    lowFlowQuench,
    o2FlowMargin,
    g,
    isFlameRetardantMaterial(material),
    isVolatileFuel(fuel_type),
  ];
}

function sigmoid(z: number): number {
  if (z > 30) return 1 - 1e-13;
  if (z < -30) return 1e-13;
  return 1 / (1 + Math.exp(-z));
}

function standardizeFit(X: number[][]): { means: number[]; stds: number[] } {
  const d = X[0].length;
  const n = X.length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(1);

  for (let j = 0; j < d; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += X[i][j];
    means[j] = sum / n;

    let sq = 0;
    for (let i = 0; i < n; i++) sq += Math.pow(X[i][j] - means[j], 2);
    const s = Math.sqrt(sq / Math.max(1, n - 1));
    stds[j] = s > 1e-6 ? s : 1.0;
  }
  return { means, stds };
}

function standardizeTransform(X: number[][], means: number[], stds: number[]): number[][] {
  return X.map((row) => row.map((v, j) => (v - means[j]) / stds[j]));
}

interface TrainedLogistic {
  weights: number[];
  bias: number;
  means: number[];
  stds: number[];
}

function trainLogisticRegression(Xraw: number[][], y: number[], l2 = 0.25, epochs = 650): TrainedLogistic {
  const { means, stds } = standardizeFit(Xraw);
  const X = standardizeTransform(Xraw, means, stds);
  const n = X.length;
  const d = X[0].length;

  const posCount = y.filter((v) => v === 1).length;
  const negCount = n - posCount;
  const wPos = posCount > 0 ? n / (2 * posCount) : 1;
  const wNeg = negCount > 0 ? n / (2 * negCount) : 1;

  const weights = new Array(d).fill(0);
  let bias = 0;
  const lr = 0.08;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(d).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      let z = bias;
      for (let j = 0; j < d; j++) z += weights[j] * X[i][j];
      const p = sigmoid(z);
      const sampleWeight = y[i] === 1 ? wPos : wNeg;
      const err = (p - y[i]) * sampleWeight;
      gradB += err;
      for (let j = 0; j < d; j++) {
        gradW[j] += err * X[i][j];
      }
    }

    bias -= (lr * gradB) / n;
    for (let j = 0; j < d; j++) {
      weights[j] -= lr * (gradW[j] / n + (l2 * weights[j]) / n);
    }
  }

  return { weights, bias, means, stds };
}

function predictLogistic(model: TrainedLogistic, xRaw: number[]): number {
  const xStd = xRaw.map((v, j) => (v - model.means[j]) / model.stds[j]);
  let z = model.bias;
  for (let j = 0; j < xStd.length; j++) z += model.weights[j] * xStd[j];
  return sigmoid(z);
}

// Deterministic seeded PRNG for reproducible Random Forest training
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TreeNode {
  leaf: boolean;
  prob?: number;
  featureIdx?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

function giniImpurity(y: number[], weights: number[]): number {
  let wTotal = 0;
  let wPos = 0;
  for (let i = 0; i < y.length; i++) {
    wTotal += weights[i];
    if (y[i] === 1) wPos += weights[i];
  }
  if (wTotal <= 0) return 0;
  const p = wPos / wTotal;
  return 1 - p * p - (1 - p) * (1 - p);
}

function buildTree(
  X: number[][],
  y: number[],
  weights: number[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  rng: () => number
): TreeNode {
  let wTotal = 0;
  let wPos = 0;
  for (let i = 0; i < y.length; i++) {
    wTotal += weights[i];
    if (y[i] === 1) wPos += weights[i];
  }
  const prob = wTotal > 0 ? wPos / wTotal : 0.5;

  if (depth >= maxDepth || y.length < minSamplesSplit || prob === 0 || prob === 1) {
    return { leaf: true, prob };
  }

  const d = X[0].length;
  const candidateFeatures: number[] = [];
  const allIdx = Array.from({ length: d }, (_, k) => k);
  // Sample sqrt(d) + 1 features per split
  const mTry = Math.min(d, Math.max(2, Math.ceil(Math.sqrt(d)) + 1));
  for (let k = 0; k < mTry; k++) {
    const pick = Math.floor(rng() * allIdx.length);
    candidateFeatures.push(allIdx[pick]);
    allIdx.splice(pick, 1);
  }

  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;
  const parentImpurity = giniImpurity(y, weights);

  for (const f of candidateFeatures) {
    const vals = Array.from(new Set(X.map((r) => r[f]))).sort((a, b) => a - b);
    if (vals.length < 2) continue;

    for (let v = 0; v < vals.length - 1; v++) {
      const thr = (vals[v] + vals[v + 1]) / 2;
      const leftY: number[] = [];
      const leftW: number[] = [];
      const rightY: number[] = [];
      const rightW: number[] = [];

      for (let i = 0; i < X.length; i++) {
        if (X[i][f] <= thr) {
          leftY.push(y[i]);
          leftW.push(weights[i]);
        } else {
          rightY.push(y[i]);
          rightW.push(weights[i]);
        }
      }

      if (leftY.length < 2 || rightY.length < 2) continue;

      const wL = leftW.reduce((a, b) => a + b, 0);
      const wR = rightW.reduce((a, b) => a + b, 0);
      const gain =
        parentImpurity -
        (wL / wTotal) * giniImpurity(leftY, leftW) -
        (wR / wTotal) * giniImpurity(rightY, rightW);

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = f;
        bestThreshold = thr;
      }
    }
  }

  if (bestFeature === -1 || bestGain <= 1e-6) {
    return { leaf: true, prob };
  }

  const leftX: number[][] = [];
  const leftY: number[] = [];
  const leftW: number[] = [];
  const rightX: number[][] = [];
  const rightY: number[] = [];
  const rightW: number[] = [];

  for (let i = 0; i < X.length; i++) {
    if (X[i][bestFeature] <= bestThreshold) {
      leftX.push(X[i]);
      leftY.push(y[i]);
      leftW.push(weights[i]);
    } else {
      rightX.push(X[i]);
      rightY.push(y[i]);
      rightW.push(weights[i]);
    }
  }

  return {
    leaf: false,
    featureIdx: bestFeature,
    threshold: bestThreshold,
    left: buildTree(leftX, leftY, leftW, depth + 1, maxDepth, minSamplesSplit, rng),
    right: buildTree(rightX, rightY, rightW, depth + 1, maxDepth, minSamplesSplit, rng),
  };
}

function predictTree(node: TreeNode, x: number[]): number {
  if (node.leaf) return node.prob ?? 0.5;
  if (x[node.featureIdx!] <= node.threshold!) {
    return predictTree(node.left!, x);
  }
  return predictTree(node.right!, x);
}

function trainRandomForest(X: number[][], y: number[], numTrees = 45): TreeNode[] {
  const rng = mulberry32(20261114);
  const n = X.length;
  const posCount = y.filter((v) => v === 1).length;
  const negCount = n - posCount;
  const wPos = posCount > 0 ? n / (2 * posCount) : 1;
  const wNeg = negCount > 0 ? n / (2 * negCount) : 1;

  const trees: TreeNode[] = [];
  for (let t = 0; t < numTrees; t++) {
    const bootX: number[][] = [];
    const bootY: number[] = [];
    const bootW: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng() * n);
      bootX.push(X[idx]);
      bootY.push(y[idx]);
      bootW.push(y[idx] === 1 ? wPos : wNeg);
    }
    trees.push(buildTree(bootX, bootY, bootW, 0, 4, 2, rng));
  }
  return trees;
}

function predictForest(trees: TreeNode[], x: number[]): { mean: number; std: number } {
  const preds = trees.map((t) => predictTree(t, x));
  const mean = preds.reduce((a, b) => a + b, 0) / preds.length;
  const variance = preds.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / preds.length;
  return { mean, std: Math.sqrt(variance) };
}

function computeMetrics(modelName: string, yTrue: number[], yProb: number[]): ModelMetrics {
  const n = yTrue.length;
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  let brier = 0;

  for (let i = 0; i < n; i++) {
    const pred = yProb[i] >= 0.5 ? 1 : 0;
    if (yTrue[i] === 1 && pred === 1) tp++;
    else if (yTrue[i] === 0 && pred === 1) fp++;
    else if (yTrue[i] === 0 && pred === 0) tn++;
    else fn++;
    brier += Math.pow(yProb[i] - yTrue[i], 2);
  }

  const accuracy = (tp + tn) / Math.max(1, n);
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1_score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Exact Wilcoxon-Mann-Whitney ROC-AUC
  const posProbs = yProb.filter((_, i) => yTrue[i] === 1);
  const negProbs = yProb.filter((_, i) => yTrue[i] === 0);
  let auc = 0.5;
  if (posProbs.length > 0 && negProbs.length > 0) {
    let wins = 0;
    for (const p of posProbs) {
      for (const q of negProbs) {
        if (p > q) wins += 1;
        else if (p === q) wins += 0.5;
      }
    }
    auc = wins / (posProbs.length * negProbs.length);
  }

  return {
    model_name: modelName,
    accuracy: Number(accuracy.toFixed(3)),
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    f1_score: Number(f1_score.toFixed(3)),
    roc_auc: Number(auc.toFixed(3)),
    brier_score: Number((brier / Math.max(1, n)).toFixed(3)),
  };
}

export class FlameGuardMLEngine {
  private rows: FeatureRow[] = [];
  private logisticModel!: TrainedLogistic;
  private forestModel: TreeNode[] = [];
  private evaluationReport!: ModelEvaluationReport;

  constructor(records: LabeledTrainingRecord[], totalExperimentsInDb: number) {
    this.fit(records, totalExperimentsInDb);
  }

  private fit(records: LabeledTrainingRecord[], totalExperimentsInDb: number) {
    this.rows = records.map((r) => ({
      x: buildFeatureVector(
        r.oxygen_pct,
        r.flow_velocity_cm_s,
        r.pressure_kpa,
        r.gravity_condition,
        r.material,
        r.fuel_type
      ),
      y: r.sustained_combustion,
      group: r.sample_group,
      record: r,
    }));

    const X = this.rows.map((r) => r.x);
    const y = this.rows.map((r) => r.y);

    // Group-based Cross-Validation (Leave-One-Sample-Group-Out) to prevent data leakage
    const uniqueGroups = Array.from(new Set(this.rows.map((r) => r.group)));
    const oofLogisticProbs = new Array(this.rows.length).fill(0.5);
    const oofForestProbs = new Array(this.rows.length).fill(0.5);

    for (const testGroup of uniqueGroups) {
      const trainIdx: number[] = [];
      const testIdx: number[] = [];
      this.rows.forEach((r, idx) => {
        if (r.group === testGroup) testIdx.push(idx);
        else trainIdx.push(idx);
      });

      const trainY = trainIdx.map((i) => y[i]);
      if (new Set(trainY).size < 2) {
        const meanY = trainY.reduce((a, b) => a + b, 0) / Math.max(1, trainY.length);
        for (const i of testIdx) {
          oofLogisticProbs[i] = meanY;
          oofForestProbs[i] = meanY;
        }
        continue;
      }

      const trainX = trainIdx.map((i) => X[i]);
      const foldLog = trainLogisticRegression(trainX, trainY, 0.2, 800);
      const foldRF = trainRandomForest(trainX, trainY, 55);

      for (const i of testIdx) {
        oofLogisticProbs[i] = predictLogistic(foldLog, X[i]);
        oofForestProbs[i] = predictForest(foldRF, X[i]).mean;
      }
    }

    const logMetrics = computeMetrics("Logistic Regression (L2 Physics-Informed)", y, oofLogisticProbs);
    const rfMetrics = computeMetrics("Random Forest Ensemble (65 Trees)", y, oofForestProbs);

    // Fit final models on all complete-feature training records
    this.logisticModel = trainLogisticRegression(X, y, 0.2, 800);
    this.forestModel = trainRandomForest(X, y, 65);

    const o2Vals = this.rows.map((r) => r.record.oxygen_pct);
    const flowVals = this.rows.map((r) => r.record.flow_velocity_cm_s);
    const pressVals = this.rows.map((r) => r.record.pressure_kpa);
    const training_ranges: TrainingRanges = {
      oxygen_pct: [Number(Math.min(...o2Vals).toFixed(1)), Number(Math.max(...o2Vals).toFixed(1))],
      flow_velocity_cm_s: [Number(Math.min(...flowVals).toFixed(1)), Number(Math.max(...flowVals).toFixed(1))],
      pressure_kpa: [Number(Math.min(...pressVals).toFixed(1)), Number(Math.max(...pressVals).toFixed(1))],
    };

    // Permutation importance on Random Forest
    const baseCorrect = X.reduce(
      (acc, row, i) => acc + ((predictForest(this.forestModel, row).mean >= 0.5 ? 1 : 0) === y[i] ? 1 : 0),
      0
    );
    const baseAcc = baseCorrect / Math.max(1, X.length);

    const rng = mulberry32(99);
    const featureImportances = FEATURE_NAMES.map((feat, j) => {
      let dropSum = 0;
      const repeats = 5;
      for (let r = 0; r < repeats; r++) {
        const permVals = X.map((row) => row[j]);
        for (let k = permVals.length - 1; k > 0; k--) {
          const swap = Math.floor(rng() * (k + 1));
          [permVals[k], permVals[swap]] = [permVals[swap], permVals[k]];
        }
        let permCorrect = 0;
        for (let i = 0; i < X.length; i++) {
          const copy = [...X[i]];
          copy[j] = permVals[i];
          if ((predictForest(this.forestModel, copy).mean >= 0.5 ? 1 : 0) === y[i]) {
            permCorrect++;
          }
        }
        dropSum += Math.max(0, baseAcc - permCorrect / X.length);
      }
      return {
        feature: feat,
        label: FEATURE_LABELS[feat],
        logistic_abs_weight: Number(Math.abs(this.logisticModel.weights[j]).toFixed(3)),
        forest_permutation_importance: Number((dropSum / repeats).toFixed(3)),
      };
    }).sort((a, b) => b.logistic_abs_weight - a.logistic_abs_weight);

    const posCount = y.filter((v) => v === 1).length;

    // Compute 50% sustained-combustion critical O2% boundary curve within observed airflow bounds
    const boundaryFlows = [0, 1, 2, 3, 5, 8, 12, 18, 25, 32, 40];
    const boundary_curve = boundaryFlows.map((flow) => {
      let lo = 10.0;
      let hi = 32.0;
      for (let iter = 0; iter < 18; iter++) {
        const mid = (lo + hi) / 2;
        const vec = buildFeatureVector(mid, flow, 101.3, "Microgravity", "PMMA (Acrylic)", "Solid Polymer");
        const p = 0.55 * predictLogistic(this.logisticModel, vec) + 0.45 * predictForest(this.forestModel, vec).mean;
        if (p < 0.5) lo = mid;
        else hi = mid;
      }
      return {
        flow_cm_s: flow,
        critical_o2_pct: Number(((lo + hi) / 2).toFixed(1)),
      };
    });

    this.evaluationReport = {
      target_outcome: "Flame sustained vs. extinction only",
      scope_notice:
        "Predicts binary flame sustained vs. extinction only. Does NOT predict fire size, flame spread rate, heat release, or severity.",
      total_experiments_in_db: totalExperimentsInDb,
      training_records_count: this.rows.length,
      validated_training_records: this.rows.length,
      excluded_records_missing_or_nonflaming: totalExperimentsInDb - this.rows.length,
      positive_class_count: posCount,
      negative_class_count: this.rows.length - posCount,
      cv_strategy: `Leave-One-Sample-Group-Out CV (${uniqueGroups.length} sample groups)`,
      unique_sample_groups: uniqueGroups.length,
      training_ranges,
      logistic_regression: logMetrics,
      random_forest: rfMetrics,
      feature_importances: featureImportances,
      boundary_curve,
      limitations: [
        `Small sample size: trained on n = ${this.rows.length} NASA records with complete O2%, airflow, pressure, and binary outcome labels; ${totalExperimentsInDb - this.rows.length} DB records (including ProofSheet PDFs lacking O2%/flow, partial configs, and non-flaming SAME-R pyrolysis runs) were kept NULL and excluded.`,
        "Predicts flame sustained vs. extinction only — does not predict fire size, spread rate, smoke yield, or severity.",
        "Research demonstration prototype only — not peer reviewed and NOT validated for spacecraft design or real fire-safety decisions.",
      ],
    };
  }

  public getEvaluationReport(): ModelEvaluationReport {
    return this.evaluationReport;
  }

  public predict(input: {
    gravity_condition: string;
    oxygen_pct: number;
    temperature_c: number;
    pressure_kpa: number;
    flow_velocity_cm_s: number;
    fuel_type: string;
    material: string;
  }): PredictionOutput {
    const { training_ranges } = this.evaluationReport;
    const out_of_range_details: OutOfRangeDetail[] = [];

    if (
      input.oxygen_pct < training_ranges.oxygen_pct[0] ||
      input.oxygen_pct > training_ranges.oxygen_pct[1]
    ) {
      out_of_range_details.push({
        parameter: "oxygen_pct",
        label: "Oxygen concentration",
        value: input.oxygen_pct,
        unit: "% vol",
        min: training_ranges.oxygen_pct[0],
        max: training_ranges.oxygen_pct[1],
      });
    }

    if (
      input.flow_velocity_cm_s < training_ranges.flow_velocity_cm_s[0] ||
      input.flow_velocity_cm_s > training_ranges.flow_velocity_cm_s[1]
    ) {
      out_of_range_details.push({
        parameter: "flow_velocity_cm_s",
        label: "Airflow velocity",
        value: input.flow_velocity_cm_s,
        unit: "cm/s",
        min: training_ranges.flow_velocity_cm_s[0],
        max: training_ranges.flow_velocity_cm_s[1],
      });
    }

    if (
      input.pressure_kpa < training_ranges.pressure_kpa[0] ||
      input.pressure_kpa > training_ranges.pressure_kpa[1]
    ) {
      out_of_range_details.push({
        parameter: "pressure_kpa",
        label: "Ambient pressure",
        value: input.pressure_kpa,
        unit: "kPa",
        min: training_ranges.pressure_kpa[0],
        max: training_ranges.pressure_kpa[1],
      });
    }

    // Top 3 nearest historical NASA experiments in standardized space (O2, flow, pressure, gravity)
    const similar_experiments: SimilarExperiment[] = this.rows
      .map((row) => {
        const dO2 = (row.record.oxygen_pct - input.oxygen_pct) / 4.5;
        const dFlow = (row.record.flow_velocity_cm_s - input.flow_velocity_cm_s) / 12.0;
        const dP = (row.record.pressure_kpa - input.pressure_kpa) / 18.0;
        const dG = (encodeGravity(row.record.gravity_condition) - encodeGravity(input.gravity_condition)) * 2.0;
        const dist = Math.sqrt(dO2 * dO2 + dFlow * dFlow + dP * dP + dG * dG);
        const sim = Math.max(0, Math.min(1, Math.exp(-0.55 * dist)));
        return {
          experiment_id: row.record.experiment_id,
          investigation_id: row.record.investigation_id,
          material: row.record.material,
          gravity_condition: row.record.gravity_condition,
          oxygen_pct: row.record.oxygen_pct,
          flow_velocity_cm_s: row.record.flow_velocity_cm_s,
          pressure_kpa: row.record.pressure_kpa,
          outcome_label: row.record.outcome_label,
          sustained_combustion: row.record.sustained_combustion,
          distance: Number(dist.toFixed(2)),
          similarity_score: Number((sim * 100).toFixed(1)),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    const prototypeNotice =
      `Demo model trained on n = ${this.rows.length} NASA records. Not validated for spacecraft design or real fire-safety decisions.`;

    if (out_of_range_details.length > 0) {
      const detailsText = out_of_range_details
        .map((d) => `${d.label} (${d.value} ${d.unit}, NASA range ${d.min}–${d.max} ${d.unit})`)
        .join("; ");
      return {
        target_outcome: this.evaluationReport.target_outcome,
        scope_notice: this.evaluationReport.scope_notice,
        out_of_range: true,
        out_of_range_details,
        training_ranges,
        logistic_probability: null,
        forest_probability: null,
        ensemble_probability: null,
        risk_category: "Out of Range",
        uncertainty_interval: null,
        model_version: "FlameGuard-Proto-v2.0 (Demo LR+RF)",
        prototype_notice: prototypeNotice,
        contributions: [],
        similar_experiments,
        explanation: `Outside the range of NASA data we have: ${detailsText}. Probability withheld to avoid ungrounded extrapolation. Compare against the 3 nearest real NASA experiments shown below.`,
      };
    }

    const xRaw = buildFeatureVector(
      input.oxygen_pct,
      input.flow_velocity_cm_s,
      input.pressure_kpa,
      input.gravity_condition,
      input.material,
      input.fuel_type
    );

    const pLog = predictLogistic(this.logisticModel, xRaw);
    const rfRes = predictForest(this.forestModel, xRaw);
    const pEnsemble = 0.55 * pLog + 0.45 * rfRes.mean;

    // Conservative uncertainty band combining ensemble disagreement + RF tree spread + small-sample margin
    const spread = Math.max(0.08, Math.abs(pLog - rfRes.mean) * 0.75 + rfRes.std * 0.65);
    const ciLow = Math.max(0.01, Number((pEnsemble - spread).toFixed(3)));
    const ciHigh = Math.min(0.99, Number((pEnsemble + spread).toFixed(3)));

    const risk_category: "Low" | "Moderate" | "High" =
      pEnsemble >= 0.65 ? "High" : pEnsemble >= 0.35 ? "Moderate" : "Low";

    // Linear log-odds feature contributions around dataset mean
    const xStd = xRaw.map((v, j) => (v - this.logisticModel.means[j]) / this.logisticModel.stds[j]);
    const contributions: FeatureContribution[] = FEATURE_NAMES.map((feat, j) => {
      const contrib = this.logisticModel.weights[j] * xStd[j];
      const impEntry = this.evaluationReport.feature_importances.find((f) => f.feature === feat);
      return {
        feature: feat,
        label: FEATURE_LABELS[feat],
        input_value:
          feat === "oxygen_pct"
            ? `${input.oxygen_pct.toFixed(1)}%`
            : feat === "pp_o2_kpa"
            ? `${((input.oxygen_pct / 100) * input.pressure_kpa).toFixed(1)} kPa`
            : feat === "log_flow_velocity"
            ? `${input.flow_velocity_cm_s.toFixed(1)} cm/s`
            : feat === "gravity_num"
            ? input.gravity_condition
            : feat === "low_flow_quench"
            ? xRaw[j] === 1
              ? "Active (<2.5 cm/s in low-g)"
              : "Inactive"
            : feat === "o2_flow_margin"
            ? xRaw[j].toFixed(2)
            : xRaw[j] === 1
            ? "Yes"
            : "No",
        contribution: Number(contrib.toFixed(3)),
        importance: impEntry?.logistic_abs_weight ?? 0,
      };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const topDriver = contributions[0];
    const secondDriver = contributions[1];
    const explanation = `Research demo prototype estimates ${(pEnsemble * 100).toFixed(1)}% probability of sustained combustion vs. extinction (uncertainty ${(ciLow * 100).toFixed(1)}%–${(ciHigh * 100).toFixed(1)}%; Logistic Regression ${(pLog * 100).toFixed(1)}%, Random Forest ${(rfRes.mean * 100).toFixed(1)}%). Primary drivers in the n=${this.rows.length} NASA feature space: ${topDriver.label} (${topDriver.contribution >= 0 ? "+" : ""}${topDriver.contribution.toFixed(2)}) and ${secondDriver.label} (${secondDriver.contribution >= 0 ? "+" : ""}${secondDriver.contribution.toFixed(2)}). Nearest NASA run: ${similar_experiments[0]?.experiment_id ?? "N/A"} (dist=${similar_experiments[0]?.distance ?? "?"}).`;

    return {
      target_outcome: this.evaluationReport.target_outcome,
      scope_notice: this.evaluationReport.scope_notice,
      out_of_range: false,
      out_of_range_details: [],
      training_ranges,
      logistic_probability: Number(pLog.toFixed(3)),
      forest_probability: Number(rfRes.mean.toFixed(3)),
      ensemble_probability: Number(pEnsemble.toFixed(3)),
      risk_category,
      uncertainty_interval: [ciLow, ciHigh],
      model_version: "FlameGuard-Proto-v2.0 (Demo LR+RF)",
      prototype_notice: prototypeNotice,
      contributions,
      similar_experiments,
      explanation,
    };
  }
}
