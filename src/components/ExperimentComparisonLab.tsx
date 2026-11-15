import React, { useMemo, useState } from "react";
import { ArrowLeftRight, ExternalLink, Flame } from "lucide-react";
import { ExperimentRecord } from "../types";
import { GlossaryTerm } from "./LabGlossaryTooltip";

interface Props {
  experiments: ExperimentRecord[];
}

function fmtVal(exp: ExperimentRecord, key: string, suffix = ""): string {
  const v = exp.metrics[key]?.value;
  if (v === null || v === undefined) return "not in source";
  return `${v}${suffix}`;
}

export const ExperimentComparisonLab: React.FC<Props> = ({ experiments }) => {
  const comparable = useMemo(
    () => experiments.filter((e) => e.metrics.oxygen_concentration?.value !== null || e.metrics.flow_velocity?.value !== null),
    [experiments]
  );

  const defaultA = useMemo(
    () =>
      comparable.find((e) => e.experiment_id.includes("BASS2") && e.sustained_combustion === 1)?.experiment_id ||
      comparable[0]?.experiment_id ||
      "",
    [comparable]
  );

  const defaultB = useMemo(
    () =>
      comparable.find((e) => e.sustained_combustion === 0 && e.experiment_id !== defaultA)?.experiment_id ||
      comparable[1]?.experiment_id ||
      defaultA,
    [comparable, defaultA]
  );

  const [expAId, setExpAId] = useState<string>(defaultA);
  const [expBId, setExpBId] = useState<string>(defaultB);
  const [morphPct, setMorphPct] = useState<number>(50);

  const expA = useMemo(
    () => experiments.find((e) => e.experiment_id === expAId) || experiments[0],
    [experiments, expAId]
  );
  const expB = useMemo(
    () => experiments.find((e) => e.experiment_id === expBId) || experiments[1] || experiments[0],
    [experiments, expBId]
  );

  const applyPairPreset = (idA: string, idB: string) => {
    const foundA = experiments.find((e) => e.experiment_id === idA);
    const foundB = experiments.find((e) => e.experiment_id === idB);
    if (foundA) setExpAId(foundA.experiment_id);
    if (foundB) setExpBId(foundB.experiment_id);
    setMorphPct(50);
  };

  if (!expA || !expB) {
    return (
      <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
        No NASA experiment records are loaded yet. Import a dataset in Library to compare two experiments side by side.
      </div>
    );
  }

  const t = morphPct / 100;
  const o2A = expA.metrics.oxygen_concentration?.value;
  const o2B = expB.metrics.oxygen_concentration?.value;
  const flowA = expA.metrics.flow_velocity?.value;
  const flowB = expB.metrics.flow_velocity?.value;
  const pressA = expA.metrics.pressure?.value;
  const pressB = expB.metrics.pressure?.value;

  const blendedO2 = o2A !== null && o2A !== undefined && o2B !== null && o2B !== undefined ? o2A * (1 - t) + o2B * t : null;
  const blendedFlow =
    flowA !== null && flowA !== undefined && flowB !== null && flowB !== undefined ? flowA * (1 - t) + flowB * t : null;
  const blendedPress =
    pressA !== null && pressA !== undefined && pressB !== null && pressB !== undefined ? pressA * (1 - t) + pressB * t : null;

  // Visual flame size / shape interpolation between Experiment A and Experiment B
  const isASustained = expA.sustained_combustion === 1;
  const isBSustained = expB.sustained_combustion === 1;
  const isACool = expA.outcome_label.toLowerCase().includes("cool");
  const isBCool = expB.outcome_label.toLowerCase().includes("cool");

  const activeFocus = t < 0.5 ? expA : expB;
  const flameIntensity = (isASustained ? 1 : 0.22) * (1 - t) + (isBSustained ? 1 : 0.22) * t;
  const isCoolBlend = (isACool && t < 0.5) || (isBCool && t >= 0.5);
  const isZeroGBlend = activeFocus.gravity_condition === "Microgravity";

  const plainCaption = useMemo(() => {
    if (t < 0.25) {
      return `Showing ${expA.experiment_id}: ${expA.material} in ${expA.gravity_condition} (${expA.outcome_label}).`;
    }
    if (t > 0.75) {
      return `Showing ${expB.experiment_id}: ${expB.material} in ${expB.gravity_condition} (${expB.outcome_label}).`;
    }
    const o2Diff =
      o2A !== null && o2A !== undefined && o2B !== null && o2B !== undefined
        ? `O2 shifts from ${o2A}% to ${o2B}%`
        : "one run omits O2% (not in source)";
    const flowDiff =
      flowA !== null && flowA !== undefined && flowB !== null && flowB !== undefined
        ? `airflow shifts from ${flowA} to ${flowB} cm/s`
        : "one run omits airflow (not in source)";
    return `Midpoint transition (${morphPct}%): ${o2Diff}, ${flowDiff} — turning ${expA.outcome_label.toLowerCase()} into ${expB.outcome_label.toLowerCase()}.`;
  }, [t, morphPct, expA, expB, o2A, o2B, flowA, flowB]);

  return (
    <div className="space-y-5">
      {/* Header + Quick Pair Presets */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 border-b border-slate-800/90 pb-4">
        <div>
          <div className="font-note text-lg text-amber-300/90">
            Chapter 03 · Side-by-Side Flame Cards
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            Compare Two Real NASA Experiments
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-3xl">
            Pick two experiments and drag the morph slider between them to see how gravity, oxygen, or airflow flips a
            flame between sustained burning and extinction.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => applyPairPreset("BASS2-PMMA-0G-O18-V10", "BASS2-PMMA-0G-O21-V005")}
            className="px-3 py-1.5 text-xs bg-[#0D1424] border border-slate-700 rounded text-slate-200 hover:border-sky-500/50"
          >
            0g Fan On vs. Quench
          </button>
          <button
            type="button"
            onClick={() => applyPairPreset("SAFFIRE-I-SIBAL", "SAFFIRE-V-EXPL-71KPA")}
            className="px-3 py-1.5 text-xs bg-[#0D1424] border border-slate-700 rounded text-slate-200 hover:border-sky-500/50"
          >
            ISS Air vs. Exploration Cabin
          </button>
          <button
            type="button"
            onClick={() => applyPairPreset("FLEX-METHANOL-O21-1ATM", "FLEX-HEPTANE-O21-1ATM")}
            className="px-3 py-1.5 text-xs bg-[#0D1424] border border-slate-700 rounded text-slate-200 hover:border-sky-500/50"
          >
            Hot Flame vs. Cool Flame
          </button>
        </div>
      </div>

      {/* Draggable Morph Bar & Interactive Flame Visualization */}
      <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <ArrowLeftRight className="w-4 h-4 text-amber-400" />
            <span>Morph Slider: Card A (0%) ↔ Card B (100%)</span>
          </div>
          <div className="text-xs font-mono text-sky-300 tabular-nums">
            {blendedO2 !== null ? `${blendedO2.toFixed(1)}% O2` : "O2: partial"} ·{" "}
            {blendedFlow !== null ? `${blendedFlow.toFixed(1)} cm/s flow` : "Flow: partial"} ·{" "}
            {blendedPress !== null ? `${blendedPress.toFixed(1)} kPa` : "Pressure: partial"}
          </div>
        </div>

        {/* Visual Morph Chamber */}
        <div className="bg-[#070B14] border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-36 h-32 shrink-0 flex items-center justify-center relative rounded-md bg-[#05080F] border border-slate-800/80">
            <svg
              viewBox="0 0 120 110"
              className="w-full h-full"
              role="img"
              aria-label="Interpolated flame state between Experiment A and Experiment B"
            >
              <rect x="57" y="76" width="6" height="22" rx="1" fill="#475569" />
              <ellipse
                cx="60"
                cy={isZeroGBlend ? 56 : 50}
                rx={(isZeroGBlend ? 22 : 16) * (0.45 + 0.65 * flameIntensity)}
                ry={(isZeroGBlend ? 22 : 28) * (0.45 + 0.65 * flameIntensity)}
                fill={isCoolBlend || activeFocus.sustained_combustion === 0 ? "#38BDF8" : "#F97316"}
                fillOpacity={0.25 + 0.55 * flameIntensity}
                stroke={isCoolBlend || activeFocus.sustained_combustion === 0 ? "#7DD3FC" : "#FDBA74"}
                strokeWidth="1.2"
              />
              <circle
                cx="60"
                cy={isZeroGBlend ? 56 : 54}
                r={7 * flameIntensity}
                fill={isCoolBlend || activeFocus.sustained_combustion === 0 ? "#E0F2FE" : "#FEF08A"}
                fillOpacity={0.9 * flameIntensity}
              />
            </svg>
            <span className="absolute bottom-1.5 left-2 font-note text-xs text-slate-400">
              {morphPct}% blend
            </span>
          </div>

          <div className="flex-1 w-full space-y-3">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={morphPct}
              onChange={(e) => setMorphPct(Number(e.target.value))}
              aria-label="Morph slider between Experiment A and Experiment B"
              className="w-full accent-amber-400 cursor-ew-resize"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>← {expA.experiment_id}</span>
              <span>{expB.experiment_id} →</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed bg-[#0B111E] border border-slate-800/80 rounded p-2.5">
              {plainCaption}
            </p>
          </div>
        </div>
      </div>

      {/* Side-by-Side Flame Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { label: "Experiment A", exp: expA, setId: setExpAId, opacity: 1 - t * 0.35, accent: "border-amber-500/40" },
          { label: "Experiment B", exp: expB, setId: setExpBId, opacity: 0.65 + t * 0.35, accent: "border-sky-500/40" },
        ].map((card) => {
          const isSustained = card.exp.sustained_combustion === 1;
          const missingO2 = card.exp.metrics.oxygen_concentration?.value == null;
          return (
            <div
              key={card.label}
              style={{ opacity: card.opacity }}
              className={`bg-[#0D1424] border ${card.accent} rounded-xl p-5 flex flex-col justify-between gap-4 transition-opacity`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-400">{card.label}</span>
                  <span
                    className={`text-xs font-semibold inline-flex items-center gap-1 ${
                      isSustained ? "text-orange-300" : card.exp.sustained_combustion === 0 ? "text-sky-300" : "text-amber-300"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    {card.exp.outcome_label}
                  </span>
                </div>

                <select
                  value={card.exp.experiment_id}
                  onChange={(e) => card.setId(e.target.value)}
                  aria-label={`Select ${card.label}`}
                  className="w-full px-3 py-2 text-xs bg-[#070B14] border border-slate-700 rounded-md text-slate-100 font-mono"
                >
                  {experiments.map((e) => (
                    <option key={e.experiment_id} value={e.experiment_id}>
                      {e.experiment_id} ({e.investigation_name} · {e.material})
                    </option>
                  ))}
                </select>

                <p className="text-xs text-slate-300 leading-relaxed">{card.exp.experiment_description}</p>

                {/* Normalized Parameter Grid */}
                <div className="bg-[#070B14] border border-slate-800 rounded-lg divide-y divide-slate-800/80 text-xs">
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-400">Gravity</span>
                    <span className="font-mono text-slate-200">{card.exp.gravity_condition}</span>
                  </div>
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-400">Material / Fuel</span>
                    <span className="text-slate-200">{card.exp.material}</span>
                  </div>
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-400">Oxygen Concentration</span>
                    <span className={`font-mono tabular-nums ${missingO2 ? "text-amber-300" : "text-slate-100"}`}>
                      {fmtVal(card.exp, "oxygen_concentration", "% vol")}
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-400">Airflow Velocity</span>
                    <span className="font-mono tabular-nums text-slate-100">
                      {fmtVal(card.exp, "flow_velocity", " cm/s")}
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-400">Ambient Pressure</span>
                    <span className="font-mono tabular-nums text-slate-100">
                      {fmtVal(card.exp, "pressure", " kPa")}
                    </span>
                  </div>
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-400">Flame Spread Rate</span>
                    <span className="font-mono tabular-nums text-slate-100">
                      {fmtVal(card.exp, "flame_spread_rate", " cm/s")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-400 truncate">{card.exp.provenance_type}</span>
                <a
                  href={card.exp.doi ? `https://doi.org/${card.exp.doi}` : card.exp.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline inline-flex items-center gap-1 shrink-0 font-mono"
                >
                  <span>Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Why does this matter? */}
      <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-4 text-xs space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-100">Why does this matter?</span>
          <div className="flex gap-3">
            <GlossaryTerm termKey="opposed_flow" label="opposed flow" />
            <GlossaryTerm termKey="cool_flame" label="cool flame" />
          </div>
        </div>
        <p className="text-slate-300 leading-relaxed">
          Comparing real pairs shows why Earth intuition fails in space: dropping airflow from 12 cm/s to ~1–2 cm/s
          extinguishes a BASS-II PMMA fire, while reducing pressure in a 29% O2 exploration cabin changes how fast flames
          spread across cotton composites. Any parameter absent from original NASA reports stays explicitly marked{" "}
          <span className="font-mono text-amber-300">not in source</span>.
        </p>
      </div>
    </div>
  );
};

