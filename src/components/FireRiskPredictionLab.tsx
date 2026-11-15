import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Gauge, SlidersHorizontal } from "lucide-react";
import { ModelEvaluationReport, PageId, PredictionOutput } from "../types";

interface Props {
  evaluation: ModelEvaluationReport;
  onPredictionGenerated?: (pred: PredictionOutput, inputs: any) => void;
  onNavigate?: (page: PageId) => void;
}

const PRESETS = [
  {
    label: "Exploration Cabin (29% O2, 65 kPa)",
    gravity_condition: "Microgravity",
    oxygen_pct: 29.0,
    temperature_c: 24.0,
    pressure_kpa: 65.0,
    flow_velocity_cm_s: 15.0,
    fuel_type: "Fabric Composite",
    material: "SIBAL (75% Cotton / 25% Fiberglass)",
  },
  {
    label: "Fan Shutdown (0.5 cm/s)",
    gravity_condition: "Microgravity",
    oxygen_pct: 21.0,
    temperature_c: 22.0,
    pressure_kpa: 101.3,
    flow_velocity_cm_s: 0.5,
    fuel_type: "Solid Polymer",
    material: "PMMA (Acrylic)",
  },
  {
    label: "ISS Nominal (21% O2, 10 cm/s)",
    gravity_condition: "Microgravity",
    oxygen_pct: 21.0,
    temperature_c: 22.5,
    pressure_kpa: 101.3,
    flow_velocity_cm_s: 10.0,
    fuel_type: "Solid Polymer",
    material: "PMMA (Acrylic)",
  },
];

export const FireRiskPredictionLab: React.FC<Props> = ({
  evaluation,
  onPredictionGenerated,
  onNavigate,
}) => {
  const [gravity, setGravity] = useState("Microgravity");
  const [oxygen, setOxygen] = useState(21.0);
  const [tempC, setTempC] = useState(22.5);
  const [pressure, setPressure] = useState(101.3);
  const [flow, setFlow] = useState(10.0);
  const [fuelType, setFuelType] = useState("Solid Polymer");
  const [material, setMaterial] = useState("PMMA (Acrylic)");

  const [prediction, setPrediction] = useState<PredictionOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ranges = evaluation.training_ranges;
  const nSamples = evaluation.training_records_count || evaluation.validated_training_records;

  const runPrediction = async (save = false, overrides?: Partial<typeof PRESETS[0]>) => {
    setLoading(true);
    setError(null);
    const payload = {
      gravity_condition: overrides?.gravity_condition ?? gravity,
      oxygen_pct: overrides?.oxygen_pct ?? oxygen,
      temperature_c: overrides?.temperature_c ?? tempC,
      pressure_kpa: overrides?.pressure_kpa ?? pressure,
      flow_velocity_cm_s: overrides?.flow_velocity_cm_s ?? flow,
      fuel_type: overrides?.fuel_type ?? fuelType,
      material: overrides?.material ?? material,
      save,
    };
    try {
      const res = await fetch("/api/ml/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Prediction request failed");
      setPrediction(json.prediction);
      onPredictionGenerated?.(json.prediction, payload);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runPrediction(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (p: (typeof PRESETS)[0]) => {
    setGravity(p.gravity_condition);
    setOxygen(p.oxygen_pct);
    setTempC(p.temperature_c);
    setPressure(p.pressure_kpa);
    setFlow(p.flow_velocity_cm_s);
    setFuelType(p.fuel_type);
    setMaterial(p.material);
    runPrediction(false, p);
  };

  const isOutOfRange = prediction?.out_of_range ?? false;
  const prob = prediction?.ensemble_probability;
  const probPct = prob !== null && prob !== undefined ? Math.round(prob * 100) : null;

  const riskColor = isOutOfRange
    ? "#94A3B8"
    : prediction?.risk_category === "High"
    ? "#F97316"
    : prediction?.risk_category === "Moderate"
    ? "#F59E0B"
    : "#38BDF8";

  // SVG gauge geometry
  const radius = 82;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - (prob ?? 0));

  return (
    <div className="space-y-5">
      {/* Persistent Top Honesty Banner (Exact Job A requirement) */}
      <div
        role="alert"
        className="bg-amber-950/35 border border-amber-500/50 rounded-xl p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-100"
      >
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-amber-200">
            Research Demonstration Prototype — Demo model trained on a small number of NASA records. Not validated for
            spacecraft design or real fire-safety decisions.
          </div>
          <p className="text-xs text-amber-100/85">
            Predicts <span className="font-semibold">flame sustained vs. extinction only</span>. It does{" "}
            <span className="underline">not</span> predict fire size, flame spread rate, heat release, or severity.{" "}
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("lessons")}
                className="ml-1 underline font-semibold text-amber-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
              >
                Why we care: lessons from past fires →
              </button>
            )}
          </p>
        </div>
      </div>

      {/* Header + Presets */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-b border-slate-800/90 pb-4">
        <div>
          <div className="font-note text-lg text-amber-300/90">
            Chapter 04 · Research Demonstration Prototype
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            Fire Risk Lab
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl">
            Spacecraft cabin instrument panel estimating <span className="text-slate-100 font-medium">flame sustained vs. extinction</span>{" "}
            within observed NASA bounds (<span className="font-mono">n = {nSamples}</span>).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 text-xs bg-[#0D1424] border border-slate-700 rounded-md text-slate-200 hover:border-amber-400/60 transition-colors whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column Instrument Deck */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: Spacecraft Instrument Dials / Sliders */}
        <div className="xl:col-span-5 bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span>Cabin &amp; Airflow Controls</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">n = {nSamples} NASA bounds shown</span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Gravity */}
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Gravity</label>
              <div className="grid grid-cols-3 gap-1.5">
                {["Microgravity", "Partial gravity", "Normal gravity"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGravity(g)}
                    className={`py-2 px-2 rounded-md border text-center transition-colors ${
                      gravity === g
                        ? "bg-sky-500/20 border-sky-400 text-sky-200 font-medium"
                        : "bg-[#070B14] border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {g === "Microgravity" ? "0g Orbit" : g === "Partial gravity" ? "Lunar/Mars" : "1g Earth"}
                  </button>
                ))}
              </div>
            </div>

            {/* O2 Slider (allows pushing outside NASA bounds to demonstrate refusal!) */}
            <div className="bg-[#070B14] border border-slate-800/90 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="o2-slider" className="text-slate-200 font-medium">
                  Oxygen Concentration
                </label>
                <span className="font-mono text-amber-300 text-sm font-semibold tabular-nums">
                  {oxygen.toFixed(1)}%
                </span>
              </div>
              <input
                id="o2-slider"
                type="range"
                min={8}
                max={40}
                step={0.5}
                value={oxygen}
                onChange={(e) => setOxygen(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>8%</span>
                <span className="text-sky-400">
                  NASA range: {ranges.oxygen_pct[0]}–{ranges.oxygen_pct[1]}%
                </span>
                <span>40%</span>
              </div>
            </div>

            {/* Airflow Slider */}
            <div className="bg-[#070B14] border border-slate-800/90 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="flow-slider" className="text-slate-200 font-medium">
                  Ventilation Airflow Velocity
                </label>
                <span className="font-mono text-sky-300 text-sm font-semibold tabular-nums">
                  {flow.toFixed(1)} cm/s
                </span>
              </div>
              <input
                id="flow-slider"
                type="range"
                min={0}
                max={55}
                step={0.5}
                value={flow}
                onChange={(e) => setFlow(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>0 cm/s</span>
                <span className="text-sky-400">
                  NASA range: {ranges.flow_velocity_cm_s[0]}–{ranges.flow_velocity_cm_s[1]} cm/s
                </span>
                <span>55 cm/s</span>
              </div>
            </div>

            {/* Pressure Slider */}
            <div className="bg-[#070B14] border border-slate-800/90 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="press-slider" className="text-slate-200 font-medium">
                  Cabin Pressure
                </label>
                <span className="font-mono text-slate-100 text-sm font-semibold tabular-nums">
                  {pressure.toFixed(1)} kPa
                </span>
              </div>
              <input
                id="press-slider"
                type="range"
                min={40}
                max={140}
                step={0.5}
                value={pressure}
                onChange={(e) => setPressure(Number(e.target.value))}
                className="w-full accent-sky-400"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>40 kPa</span>
                <span className="text-sky-400">
                  NASA range: {ranges.pressure_kpa[0]}–{ranges.pressure_kpa[1]} kPa
                </span>
                <span>140 kPa</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Fuel Class</label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#070B14] border border-slate-800 rounded text-slate-200"
                >
                  <option value="Solid Polymer">Solid Polymer</option>
                  <option value="Fabric Composite">Fabric Composite</option>
                  <option value="Liquid Droplet">Liquid Droplet</option>
                  <option value="Gaseous Jet">Gaseous Jet</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Material / Fuel</label>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#070B14] border border-slate-800 rounded text-slate-200"
                >
                  <option value="PMMA (Acrylic)">PMMA (Acrylic)</option>
                  <option value="SIBAL (75% Cotton / 25% Fiberglass)">SIBAL Cotton-Fiberglass</option>
                  <option value="Nomex HT90-40">Nomex HT90-40 (FR)</option>
                  <option value="n-Heptane (C7H16)">n-Heptane Droplet</option>
                  <option value="Methanol (CH3OH)">Methanol Droplet</option>
                  <option value="Ethylene (C2H4)">Ethylene Gas Jet</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => runPrediction(true)}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-2"
            >
              <Gauge className="w-4 h-4" />
              <span>{loading ? "Checking NASA Bounds..." : "Run Prototype Check"}</span>
            </button>

            {error && <div className="text-red-400 text-xs">{error}</div>}
          </div>
        </div>

        {/* Right: Calm Gauge / Out-of-Range Hatched State + 3 Nearest NASA Experiments */}
        <div className="xl:col-span-7 space-y-5">
          {prediction && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Gauge Card */}
                <div
                  className={`border rounded-xl p-5 flex flex-col items-center justify-between ${
                    isOutOfRange
                      ? "bg-[#0D1424] bg-hatch-unexplored border-amber-500/50"
                      : "bg-[#0D1424] border-slate-800"
                  }`}
                >
                  <div className="w-full flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Sustained vs. Extinction</span>
                    <span className="font-mono text-slate-400">n = {nSamples}</span>
                  </div>

                  {isOutOfRange ? (
                    /* Hatched "No Data" State — NO probability shown */
                    <div className="my-4 w-full text-center space-y-3">
                      <svg viewBox="0 0 210 115" className="w-52 mx-auto" aria-label="Outside training data gauge">
                        <defs>
                          <pattern id="gaugeHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                            <line x1="0" y1="0" x2="0" y2="8" stroke="#F59E0B" strokeOpacity="0.45" strokeWidth="2.5" />
                          </pattern>
                        </defs>
                        <path
                          d="M 23 100 A 82 82 0 0 1 187 100"
                          fill="none"
                          stroke="url(#gaugeHatch)"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                        <text x="105" y="76" textAnchor="middle" fill="#FCD34D" fontSize="13" fontFamily="monospace" fontWeight="bold">
                          NO DATA
                        </text>
                        <text x="105" y="96" textAnchor="middle" fill="#94A3B8" fontSize="9.5" fontFamily="sans-serif">
                          Probability withheld
                        </text>
                      </svg>
                      <div className="bg-[#070B14]/95 border border-amber-500/40 rounded-lg p-3 text-left text-xs space-y-1.5">
                        <div className="font-semibold text-amber-300">
                          Outside the range of NASA data we have
                        </div>
                        <ul className="space-y-1 text-slate-300">
                          {prediction.out_of_range_details.map((d) => (
                            <li key={d.parameter} className="font-mono text-[11px]">
                              • {d.label}: <span className="text-amber-300">{d.value} {d.unit}</span> (NASA data:{" "}
                              {d.min}–{d.max} {d.unit})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative my-3 flex flex-col items-center">
                        <svg width="210" height="118" viewBox="0 0 210 118" aria-label="Sustained combustion gauge">
                          <path
                            d="M 23 100 A 82 82 0 0 1 187 100"
                            fill="none"
                            stroke="#1E293B"
                            strokeWidth="14"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 23 100 A 82 82 0 0 1 187 100"
                            fill="none"
                            stroke={riskColor}
                            strokeWidth="14"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                          />
                        </svg>
                        <div className="absolute bottom-2 text-center">
                          <div className="text-3xl font-mono font-bold text-slate-50 tabular-nums">
                            {probPct}%
                          </div>
                          <div className="text-xs font-semibold" style={{ color: riskColor }}>
                            {prediction.risk_category} Indicator (binary only)
                          </div>
                        </div>
                      </div>

                      <div className="w-full border-t border-slate-800 pt-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Uncertainty interval:</span>
                          <span className="font-mono text-slate-200 tabular-nums">
                            {prediction.uncertainty_interval
                              ? `${(prediction.uncertainty_interval[0] * 100).toFixed(1)}% – ${(prediction.uncertainty_interval[1] * 100).toFixed(1)}%`
                              : "not in source"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Does not predict fire size, spread rate, or severity.
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Feature Contributions OR Out-of-Range Explanation */}
                <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      {isOutOfRange ? "Why Probability Is Withheld" : "Main Input Drivers"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isOutOfRange
                        ? "Extrapolating a 30-point model past observed bounds is scientifically dishonest."
                        : "Positive shifts (orange) raise sustained-flame odds; negative (blue) favor extinction."}
                    </p>
                  </div>

                  {!isOutOfRange && prediction.contributions.length > 0 ? (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={prediction.contributions.slice(0, 6)} layout="vertical" margin={{ left: 6, right: 12 }}>
                          <CartesianGrid stroke="#1E293B" horizontal={false} />
                          <XAxis type="number" stroke="#64748B" fontSize={10} />
                          <YAxis type="category" dataKey="label" stroke="#94A3B8" fontSize={10} width={140} />
                          <ReferenceLine x={0} stroke="#475569" />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#070B14", borderColor: "#334155", fontSize: "12px" }}
                            formatter={(v: any) => [`${v > 0 ? "+" : ""}${v}`, "Log-odds shift"]}
                          />
                          <Bar dataKey="contribution" barSize={12}>
                            {prediction.contributions.slice(0, 6).map((c) => (
                              <Cell key={c.feature} fill={c.contribution >= 0 ? "#F97316" : "#38BDF8"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-[#070B14] border border-slate-800 rounded-lg p-4 text-xs text-slate-300 leading-relaxed">
                      {prediction.explanation}
                    </div>
                  )}

                  {!isOutOfRange && (
                    <p className="text-[11px] text-slate-300 leading-relaxed border-t border-slate-800 pt-2">
                      {prediction.explanation}
                    </p>
                  )}
                </div>
              </div>

              {/* 3 Nearest Real NASA Experiments with Distance */}
              <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h2 className="text-sm font-semibold text-slate-100">
                    3 Nearest Real NASA Experiments (Feature-Space Distance)
                  </h2>
                  <span className="text-[11px] font-mono text-slate-400">
                    Lower distance = closer to your sliders
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {prediction.similar_experiments.slice(0, 3).map((sim, idx) => (
                    <div
                      key={sim.experiment_id}
                      className="bg-[#070B14] border border-slate-800 rounded-lg p-3.5 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sky-300 font-semibold truncate">
                          #{idx + 1} {sim.experiment_id}
                        </span>
                        <span className="font-mono text-amber-300 shrink-0 tabular-nums">
                          dist = {sim.distance.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-slate-200 font-medium truncate">{sim.material}</div>
                      <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {sim.oxygen_pct}% O2 · {sim.flow_velocity_cm_s} cm/s · {sim.pressure_kpa} kPa
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          sim.sustained_combustion === 1 ? "text-orange-300" : "text-sky-300"
                        }`}
                      >
                        Observed: {sim.outcome_label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Cross-Validation Metrics Table (Always states sample count n = ... next to every metric!) */}
          <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Cross-Validation Benchmark Metrics (Small-Sample Disclosure)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every score below was measured on <span className="font-mono text-sky-300">n = {nSamples}, leave-one-group-out CV</span>{" "}
                  ({evaluation.positive_class_count} sustained / {evaluation.negative_class_count} extinguished)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[evaluation.logistic_regression, evaluation.random_forest].map((m) => (
                <div key={m.model_name} className="bg-[#070B14] border border-slate-800 rounded-lg p-3.5 space-y-2">
                  <div className="font-semibold text-slate-100">{m.model_name}</div>
                  <div className="space-y-1 font-mono tabular-nums text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">ROC-AUC:</span>
                      <span className="text-emerald-300">
                        {m.roc_auc.toFixed(3)} <span className="text-slate-500">(n = {nSamples}, leave-one-group-out CV)</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">F1-Score:</span>
                      <span className="text-sky-300">
                        {m.f1_score.toFixed(3)} <span className="text-slate-500">(n = {nSamples}, leave-one-group-out CV)</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Brier Score:</span>
                      <span className="text-slate-200">
                        {m.brier_score.toFixed(3)} <span className="text-slate-500">(n = {nSamples}, leave-one-group-out CV)</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

