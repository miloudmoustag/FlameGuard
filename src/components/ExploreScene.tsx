import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { BookOpen, ExternalLink, MapPin, X } from "lucide-react";
import { ExperimentRecord, FindingRecord } from "../types";
import { GlossaryTerm } from "./LabGlossaryTooltip";

interface Props {
  experiments: ExperimentRecord[];
  findings: FindingRecord[];
  initialExperimentId?: string;
}

interface MapPoint {
  id: string;
  investigation: string;
  material: string;
  gravity: string;
  oxygen: number;
  flow: number;
  pressure: number;
  outcome: string;
  source: string;
  doi: string | null;
  record: ExperimentRecord;
}

export const ExploreScene: React.FC<Props> = ({ experiments, findings, initialExperimentId }) => {
  const [subTab, setSubTab] = useState<"map" | "findings">("map");
  const [gravityFilter, setGravityFilter] = useState<string>("all");
  const [selectedExp, setSelectedExp] = useState<ExperimentRecord | null>(null);
  const [findingQuery, setFindingQuery] = useState("");

  useEffect(() => {
    if (!initialExperimentId || experiments.length === 0) return;
    const match = experiments.find((e) => e.experiment_id === initialExperimentId);
    if (match) {
      setSubTab("map");
      setGravityFilter("all");
      setSelectedExp(match);
    }
  }, [initialExperimentId, experiments]);

  const { sustainedPoints, extinguishedPoints, missingCoordsCount } = useMemo(() => {
    const sustained: MapPoint[] = [];
    const extinguished: MapPoint[] = [];
    let missing = 0;

    for (const e of experiments) {
      if (gravityFilter !== "all" && e.gravity_condition !== gravityFilter) continue;
      const o2 = e.metrics.oxygen_concentration?.value;
      const flow = e.metrics.flow_velocity?.value;
      if (o2 === null || o2 === undefined || flow === null || flow === undefined) {
        missing++;
        continue;
      }
      const pt: MapPoint = {
        id: e.experiment_id,
        investigation: e.investigation_name,
        material: e.material,
        gravity: e.gravity_condition,
        oxygen: o2,
        flow,
        pressure: e.metrics.pressure?.value ?? 101.3,
        outcome: e.outcome_label,
        source: e.source_url,
        doi: e.doi,
        record: e,
      };
      if (e.sustained_combustion === 1) sustained.push(pt);
      else if (e.sustained_combustion === 0) extinguished.push(pt);
    }

    return { sustainedPoints: sustained, extinguishedPoints: extinguished, missingCoordsCount: missing };
  }, [experiments, gravityFilter]);

  const totalPlotted = sustainedPoints.length + extinguishedPoints.length;

  const filteredFindings = useMemo(() => {
    const q = findingQuery.trim().toLowerCase();
    if (!q) return findings;
    return findings.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.investigation_name.toLowerCase().includes(q) ||
        f.observation.toLowerCase().includes(q) ||
        f.researcher_conclusion.toLowerCase().includes(q)
    );
  }, [findings, findingQuery]);

  const formatMetric = (exp: ExperimentRecord, key: string) => {
    const m = exp.metrics[key];
    if (!m || m.value === null || m.value === undefined) {
      return <span className="font-mono text-amber-300/90">not in source</span>;
    }
    return (
      <span className="font-mono text-slate-100 tabular-nums">
        {m.value} {m.unit}
      </span>
    );
  };

  return (
    <div className="space-y-5 relative">
      {/* Header + Sub-mode Switch */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-800/90 pb-4">
        <div>
          <div className="font-note text-lg text-amber-300/90">
            Chapter 02 · Interactive Flammability Map &amp; Notes
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            Explore NASA Microgravity Regimes
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-3xl">
            Click any NASA record dot to inspect full measurements and citations. Hatched zones mark{" "}
            <span className="text-slate-200 font-medium">unexplored regions</span> missing from our imported runs.
          </p>
        </div>

        <div className="inline-flex rounded-lg bg-[#0D1424] border border-slate-800 p-1 w-fit shrink-0">
          <button
            type="button"
            onClick={() => setSubTab("map")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
              subTab === "map" ? "bg-sky-500/20 text-sky-200 border border-sky-500/40" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Flammability Map ({totalPlotted})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab("findings")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 transition-colors ${
              subTab === "findings"
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Findings ({findings.length})</span>
          </button>
        </div>
      </div>

      {subTab === "map" ? (
        <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Flammability Map: Oxygen (%) vs. Airflow Velocity (cm/s)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Plotted from {totalPlotted} real NASA runs ({missingCoordsCount} runs omitted where O2% or flow is{" "}
                <span className="font-mono">not in source</span>)
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="explore-gravity-filter" className="text-slate-400">
                Gravity:
              </label>
              <select
                id="explore-gravity-filter"
                value={gravityFilter}
                onChange={(e) => setGravityFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#070B14] border border-slate-700 rounded text-slate-200 text-xs"
              >
                <option value="all">All gravities</option>
                <option value="Microgravity">0g Microgravity</option>
                <option value="Partial gravity">Partial gravity</option>
                <option value="Normal gravity">1g Normal gravity</option>
              </select>
            </div>
          </div>

          {totalPlotted === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-lg p-6 text-xs text-slate-400 space-y-2">
              <p>No imported experiments in this gravity filter have both O2% and airflow velocity recorded.</p>
              <button
                type="button"
                onClick={() => setGravityFilter("all")}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Show all gravities
              </button>
            </div>
          ) : (
            <div className="relative h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 14, right: 20, bottom: 18, left: 4 }}>
                  <defs>
                    <pattern id="unexploredHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="10" stroke="#64748B" strokeOpacity="0.26" strokeWidth="2" />
                    </pattern>
                  </defs>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                  {/* Unexplored regions */}
                  <ReferenceArea x1={10} x2={13} y1={0} y2={50} fill="url(#unexploredHatch)" fillOpacity={0.9} />
                  <ReferenceArea x1={31.5} x2={36} y1={0} y2={50} fill="url(#unexploredHatch)" fillOpacity={0.9} />
                  <ReferenceArea x1={13} x2={31.5} y1={41} y2={50} fill="url(#unexploredHatch)" fillOpacity={0.9} />

                  <XAxis
                    type="number"
                    dataKey="oxygen"
                    name="Oxygen Concentration"
                    unit="%"
                    domain={[10, 36]}
                    stroke="#94A3B8"
                    fontSize={11}
                    label={{ value: "Oxygen Concentration (% vol)", position: "insideBottom", offset: -10, fill: "#94A3B8", fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="flow"
                    name="Airflow Velocity"
                    unit=" cm/s"
                    domain={[0, 50]}
                    stroke="#94A3B8"
                    fontSize={11}
                    label={{ value: "Flow (cm/s)", angle: -90, position: "insideLeft", fill: "#94A3B8", fontSize: 11 }}
                  />
                  <ZAxis type="number" dataKey="pressure" range={[80, 190]} name="Pressure (kPa)" />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload as MapPoint;
                      return (
                        <div className="bg-[#070B14] border border-slate-700 rounded-md p-3 text-xs space-y-1 shadow-xl max-w-xs">
                          <div className="font-mono text-sky-300 font-semibold">{pt.id}</div>
                          <div className="text-slate-100 font-medium">{pt.material}</div>
                          <div className="text-slate-400">
                            {pt.investigation} · {pt.gravity}
                          </div>
                          <div className="font-mono text-slate-200 tabular-nums">
                            {pt.oxygen}% O2 · {pt.flow} cm/s · {pt.pressure} kPa
                          </div>
                          <div className={pt.record.sustained_combustion === 1 ? "text-orange-300" : "text-sky-300"}>
                            {pt.outcome}
                          </div>
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                            Click point to inspect citation &amp; full telemetry
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "6px" }} />
                  <Scatter
                    name="Sustained Flame / Cool Flame"
                    data={sustainedPoints}
                    fill="#F97316"
                    className="cursor-pointer"
                    onClick={(data: any) => {
                      if (data?.record) setSelectedExp(data.record);
                    }}
                  />
                  <Scatter
                    name="Extinction / No Ignition"
                    data={extinguishedPoints}
                    fill="#38BDF8"
                    className="cursor-pointer"
                    onClick={(data: any) => {
                      if (data?.record) setSelectedExp(data.record);
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <div className="hidden sm:block absolute top-5 right-7 font-note text-base text-slate-400 pointer-events-none">
                hatched = unexplored in NASA dataset
              </div>
            </div>
          )}

          {/* Glossary + Why does this matter? + Accessibility text summary */}
          <div className="bg-[#070B14] border border-slate-800/80 rounded-lg p-4 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-100">Why does this matter?</span>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <GlossaryTerm termKey="quenching" label="quenching" />
                <GlossaryTerm termKey="concurrent_flow" label="concurrent flow" />
                <GlossaryTerm termKey="normoxic" label="normoxic" />
              </div>
            </div>
            <p className="text-slate-300 leading-relaxed">
              This map shows where NASA observed fires keep burning versus go out: in microgravity, very low airflow
              (below ~2–3 cm/s) tends to quench flames even near 21% O2, whereas higher O2 in{" "}
              <GlossaryTerm termKey="normoxic" label="normoxic" /> exploration cabins lowers the safety margin. Hatched
              areas show conditions where we have zero imported test points—not guaranteed safety.
            </p>
            <p className="text-[11px] text-slate-400">
              Text summary: {sustainedPoints.length} sustained combustion runs (generally 18–31% O2 and 3–40 cm/s flow)
              vs. {extinguishedPoints.length} extinction/no-ignition runs (concentrated below 18% O2 or near 0–2.5 cm/s
              airflow).
            </p>
          </div>
        </div>
      ) : (
        /* Findings Notebook View */
        <div className="space-y-4">
          <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              value={findingQuery}
              onChange={(e) => setFindingQuery(e.target.value)}
              placeholder="Filter NASA findings by mission, keyword, or measurement..."
              className="w-full sm:max-w-md px-3 py-2 text-xs bg-[#070B14] border border-slate-800 rounded text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
            <span className="text-xs font-mono text-slate-400">
              Showing {filteredFindings.length} cited findings
            </span>
          </div>

          {filteredFindings.length === 0 ? (
            <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 space-y-2">
              <p>No findings matched &ldquo;{findingQuery}&rdquo; in our imported NASA archive.</p>
              <button
                type="button"
                onClick={() => setFindingQuery("")}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredFindings.map((f) => (
                <article
                  key={f.finding_id}
                  className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                      <span className="text-sky-400 font-semibold">{f.investigation_name} · {f.gravity_condition}</span>
                      <span>{f.finding_id}</span>
                    </div>
                    <h2 className="text-sm font-semibold text-slate-100 leading-snug">{f.title}</h2>
                    <p className="text-xs text-slate-300 leading-relaxed">{f.observation}</p>
                    <div className="bg-[#070B14] border border-slate-800/80 rounded p-2.5 text-xs text-amber-200/90">
                      <span className="font-semibold text-amber-300">Why it matters: </span>
                      {f.safety_implication}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="text-slate-400 truncate max-w-[75%]">{f.citation}</span>
                    <a
                      href={f.doi ? `https://doi.org/${f.doi}` : f.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Side Drawer for Clicked Experiment Dot */}
      {selectedExp && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Experiment Detail Drawer">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSelectedExp(null)} aria-hidden="true" />
          <aside className="relative z-10 w-full max-w-md bg-[#0A101E] border-l border-slate-800 p-5 sm:p-6 overflow-y-auto flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-mono text-sky-400">{selectedExp.experiment_id}</div>
                  <h2 className="text-lg font-semibold text-slate-50 mt-0.5">{selectedExp.material}</h2>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {selectedExp.investigation_name} · {selectedExp.gravity_condition} · {selectedExp.experimental_date}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedExp(null)}
                  className="p-1.5 rounded text-slate-400 hover:text-white border border-slate-800"
                  aria-label="Close experiment drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-[#070B14] border border-slate-800 rounded-lg p-3.5 text-xs space-y-1">
                <div className="text-slate-400">Observed Outcome</div>
                <div
                  className={`font-semibold text-sm ${
                    selectedExp.sustained_combustion === 1
                      ? "text-orange-300"
                      : selectedExp.sustained_combustion === 0
                      ? "text-sky-300"
                      : "text-amber-300"
                  }`}
                >
                  {selectedExp.outcome_label}
                </div>
                <p className="text-slate-300 leading-relaxed pt-1">{selectedExp.experiment_description}</p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-200">
                  Recorded Measurements (missing values explicitly labeled)
                </div>
                <div className="bg-[#070B14] border border-slate-800 rounded-lg divide-y divide-slate-800/80 text-xs">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400">Oxygen concentration</span>
                    {formatMetric(selectedExp, "oxygen_concentration")}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400">Airflow velocity</span>
                    {formatMetric(selectedExp, "flow_velocity")}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400">Ambient pressure</span>
                    {formatMetric(selectedExp, "pressure")}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400">Chamber temperature</span>
                    {formatMetric(selectedExp, "temperature")}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-slate-400">Flame spread rate</span>
                    {formatMetric(selectedExp, "flame_spread_rate")}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <div className="font-medium text-slate-300">Data Integrity Note</div>
                <p className="leading-relaxed">{selectedExp.data_quality_note}</p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-mono text-slate-400">{selectedExp.provenance_type}</span>
              <a
                href={selectedExp.doi ? `https://doi.org/${selectedExp.doi}` : selectedExp.source_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded bg-sky-500/15 border border-sky-500/40 text-sky-300 hover:bg-sky-500/25 inline-flex items-center gap-1.5"
              >
                <span>{selectedExp.doi ? `DOI: ${selectedExp.doi}` : "Open NASA Source"}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
