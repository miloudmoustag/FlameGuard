import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckSquare,
  Compass,
  Droplets,
  ExternalLink,
  Fan,
  Flame,
  HelpCircle,
  Info,
  ShieldAlert,
  Sparkles,
  Wind,
} from "lucide-react";
import {
  LessonFact,
  LessonIncident,
  LessonsLearnedData,
  PageId,
} from "../types";

interface Props {
  onNavigate: (page: PageId, investigationId?: string, experimentId?: string) => void;
}

type IncidentTab = "happened" | "changed" | "microgravity";
type LowerSectionTab = "changed" | "science" | "hardware" | "takeaways" | "unknown";
type ChangeTag = "Atmosphere" | "Materials" | "Wiring" | "Escape" | "Training";

const CHANGE_TAGS: ChangeTag[] = ["Atmosphere", "Materials", "Wiring", "Escape", "Training"];

const TIMELINE_ORDER = ["APOLLO-1", "APOLLO-13", "MIR-1997", "TODAY-ISS"] as const;
type TimelineNodeId = (typeof TIMELINE_ORDER)[number];

const NODE_META: Record<TimelineNodeId, { shortTitle: string; year: string; subtitle: string }> = {
  "APOLLO-1": {
    shortTitle: "Apollo 1",
    year: "1967",
    subtitle: "Ground-test cabin fire",
  },
  "APOLLO-13": {
    shortTitle: "Apollo 13",
    year: "1970",
    subtitle: "O2 tank 2 electrical fire",
  },
  "MIR-1997": {
    shortTitle: "Mir",
    year: "1997",
    subtitle: "Orbital SFOG candle fire",
  },
  "TODAY-ISS": {
    shortTitle: "Today: ISS and our experiments",
    year: "ISS / 2026",
    subtitle: "Hardware & PSI tests",
  },
};

function isNasaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith("nasa.gov");
  } catch {
    return url.toLowerCase().includes("nasa.gov");
  }
}

function getTagsForText(text: string): ChangeTag[] {
  const t = text.toLowerCase();
  const tags: ChangeTag[] = [];
  if (t.includes("oxygen") || t.includes("o2") || t.includes("atmosphere") || t.includes("elektron")) {
    tags.push("Atmosphere");
  }
  if (t.includes("material") || t.includes("combustible") || t.includes("self-extinguishing") || t.includes("screen") || t.includes("candle")) {
    tags.push("Materials");
  }
  if (t.includes("wiring") || t.includes("plumbing") || t.includes("teflon") || t.includes("thermostat") || t.includes("heater") || t.includes("gauge")) {
    tags.push("Wiring");
  }
  if (t.includes("hatch") || t.includes("egress") || t.includes("soyuz") || t.includes("escape")) {
    tags.push("Escape");
  }
  if (t.includes("training") || t.includes("controller") || t.includes("culture") || t.includes("hazardous")) {
    tags.push("Training");
  }
  return tags;
}

const SourceQualityBadge: React.FC<{
  quality: string;
  integrityRule: string;
}> = ({ quality, integrityRule }) => {
  const [open, setOpen] = useState(false);
  const isNasa = quality === "NASA";

  return (
    <span className="relative inline-flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${
          isNasa
            ? "bg-emerald-500/12 border-emerald-500/40 text-emerald-300"
            : "bg-amber-500/12 border-amber-500/45 text-amber-300"
        }`}
      >
        {isNasa ? "NASA source" : "Secondary source, verify"}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="Explain source quality badge"
        aria-expanded={open}
        className="text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-full p-0.5"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 bottom-full mb-1.5 z-30 w-64 sm:w-72 p-2.5 rounded-lg bg-[#050912] border border-slate-700 text-[11px] text-slate-200 shadow-xl leading-relaxed pointer-events-none"
        >
          <span className="font-semibold text-sky-300 block mb-0.5">Source verification rule:</span>
          {integrityRule}
        </span>
      )}
    </span>
  );
};

const FactRow: React.FC<{ fact: LessonFact; integrityRule: string }> = ({ fact, integrityRule }) => (
  <li className="bg-[#070B14] border border-slate-800/90 rounded-lg p-3.5 space-y-2">
    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{fact.fact}</p>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <SourceQualityBadge quality={fact.source_quality} integrityRule={integrityRule} />
      <a
        href={fact.source}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0D1424] border border-slate-700 text-[11px] font-mono text-sky-300 hover:border-sky-400/70 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <span className="truncate max-w-[200px] sm:max-w-[260px]">
          {fact.source.replace(/^https?:\/\//, "").split("/")[0]}
        </span>
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    </div>
  </li>
);

export const LessonsFromFireScene: React.FC<Props> = ({ onNavigate }) => {
  const prefersReducedMotion = useReducedMotion();
  const [data, setData] = useState<LessonsLearnedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<TimelineNodeId>("APOLLO-1");
  const [incidentTab, setIncidentTab] = useState<IncidentTab>("happened");
  const [lowerTab, setLowerTab] = useState<LowerSectionTab>("changed");
  const [activeChangeTag, setActiveChangeTag] = useState<ChangeTag | null>(null);

  const fetchLessons = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lessons");
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status} loading lessons archive.`);
      }
      const json: LessonsLearnedData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Unable to load /api/lessons.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, []);

  const selectIncidentAndScroll = (id: TimelineNodeId) => {
    setSelectedNode(id);
    setIncidentTab("happened");
    const el = document.getElementById("lessons-timeline");
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading Lessons from Fire">
        <div className="h-8 w-64 bg-slate-800/70 rounded animate-pulse" />
        <div className="h-4 w-96 max-w-full bg-slate-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-20 bg-[#0D1424] border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-[#0D1424] border border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        role="alert"
        className="bg-[#0D1424] border border-red-500/45 rounded-xl p-6 space-y-3 text-sm text-red-200"
      >
        <div className="flex items-center gap-2 font-semibold text-red-300">
          <AlertTriangle className="w-5 h-5" />
          <span>Unable to load Lessons from Fire</span>
        </div>
        <p className="text-xs text-slate-300">{error || "The /api/lessons endpoint returned no data."}</p>
        <button
          type="button"
          onClick={fetchLessons}
          className="px-4 py-2 text-xs font-medium bg-red-500/20 border border-red-500/40 rounded text-red-100 hover:bg-red-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Retry Loading Lessons
        </button>
      </div>
    );
  }

  const incidentMap: Record<string, LessonIncident> = {};
  for (const inc of data.incidents) {
    incidentMap[inc.id] = inc;
  }

  const activeIncident: LessonIncident | undefined =
    selectedNode !== "TODAY-ISS" ? incidentMap[selectedNode] : undefined;

  const apollo1 = incidentMap["APOLLO-1"];
  const apollo13 = incidentMap["APOLLO-13"];
  const mir1997 = incidentMap["MIR-1997"];

  // Strictly derive What Changed items per column from flameguard_lessons_learned.json
  const apollo1Changes = (apollo1?.changes_made || []).map((text) => ({
    text,
    tags: getTagsForText(text),
  }));
  const apollo13Changes = apollo13
    ? [
        ...(apollo13.facts[3]
          ? [{ text: apollo13.facts[3].fact, tags: getTagsForText(apollo13.facts[3].fact) }]
          : []),
        ...(apollo13.facts[2]
          ? [{ text: apollo13.facts[2].fact, tags: getTagsForText(apollo13.facts[2].fact) }]
          : []),
      ]
    : [];
  const mirChanges = (mir1997?.changes_made || []).map((text) => ({
    text,
    tags: getTagsForText(text),
  }));

  const integrityRule = data._meta.integrity_rule;

  const handleEvidenceJump = (ev: string) => {
    const normalized = ev.toUpperCase();
    if (normalized === "APOLLO-1" || normalized === "APOLLO-13" || normalized === "MIR-1997") {
      selectIncidentAndScroll(normalized as TimelineNodeId);
    } else if (normalized.includes("BASS")) {
      onNavigate("story");
    } else if (normalized.includes("SAFFIRE")) {
      onNavigate("explore");
    } else {
      selectIncidentAndScroll("TODAY-ISS");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Intro + Warning */}
      <div className="border-b border-slate-800/90 pb-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <div className="font-note text-lg text-amber-300/90">
              Chapter 06B · Spacecraft Fire History &amp; Engineering Lessons
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
              Lessons from Fire
            </h1>
            <p className="mt-1 text-sm sm:text-base text-slate-200 max-w-3xl">
              Every rule in spacecraft fire safety was paid for by a real event. Here is what we learned.
            </p>
          </div>
          <div className="text-[11px] font-mono text-slate-400 shrink-0">
            Source archive · {data._meta.generated}
          </div>
        </div>

        <div className="bg-amber-950/30 border border-amber-500/45 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-amber-100">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{data._meta.warning}</span>
        </div>
      </div>

      {/* 1. TIMELINE SCENE (Main View: horizontal on md+, vertical stepper on 380px mobile) */}
      <section id="lessons-timeline" aria-label="Spacecraft Fire Timeline" className="space-y-4">
        <div className="relative">
          {/* Connecting track on desktop */}
          <div
            className="hidden md:block absolute top-6 left-10 right-10 h-0.5 bg-slate-800 pointer-events-none"
            aria-hidden="true"
          />
          <ol className="grid grid-cols-1 md:grid-cols-4 gap-3 relative z-10">
            {TIMELINE_ORDER.map((nodeId, idx) => {
              const meta = NODE_META[nodeId];
              const isSelected = selectedNode === nodeId;
              return (
                <li key={nodeId} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNode(nodeId);
                      setIncidentTab("happened");
                    }}
                    aria-current={isSelected ? "step" : undefined}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      isSelected
                        ? "bg-[#111A2E] border-amber-400/75 shadow-lg shadow-amber-950/20"
                        : "bg-[#0D1424] border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold ${
                          isSelected
                            ? "bg-amber-400 text-slate-950"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-mono text-xs text-amber-300">{meta.year}</span>
                    </div>
                    <div className="mt-2 font-display text-sm sm:text-base font-bold text-slate-50 leading-snug">
                      {meta.shortTitle}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{meta.subtitle}</div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Animated Full Incident / Today Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedNode}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="bg-[#0D1424] border border-slate-800 rounded-xl p-4 sm:p-6 space-y-5"
          >
            {activeIncident ? (
              <>
                {/* Incident Panel Header */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className="text-amber-300 font-semibold">{activeIncident.id}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-300">{activeIncident.date}</span>
                    </div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-50">
                      {NODE_META[selectedNode].shortTitle} — {activeIncident.type}
                    </h2>
                  </div>

                  {/* Environment Summary Pills */}
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                    {Object.entries(activeIncident.environment).map(([k, v]) => (
                      <div
                        key={k}
                        className="px-2.5 py-1 rounded bg-[#070B14] border border-slate-800 text-slate-300"
                      >
                        <span className="text-slate-500">{k.replace(/_/g, " ")}: </span>
                        <span className="text-slate-100">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Apollo 1 Specific Visual: Hatch Time vs Oxygen Consumption */}
                {activeIncident.id === "APOLLO-1" && (
                  <div className="bg-[#070B14] border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-100">
                        Why cabin egress failed: oxygen consumption vs. inward hatch opening time
                      </div>
                      <span className="font-mono text-[11px] text-emerald-300">NASA source</span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[11px]">
                          <span className="text-orange-300">Time fire used the oxygen</span>
                          <span className="text-orange-300 tabular-nums">~25 s</span>
                        </div>
                        <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <motion.div
                            initial={{ width: prefersReducedMotion ? "27.8%" : "0%" }}
                            animate={{ width: "27.8%" }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.7, ease: "easeOut" }}
                            className="h-full bg-orange-500 rounded-full"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[11px]">
                          <span className="text-sky-300">Time to open hatch</span>
                          <span className="text-sky-300 tabular-nums">90+ s</span>
                        </div>
                        <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <motion.div
                            initial={{ width: prefersReducedMotion ? "100%" : "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.9, ease: "easeOut" }}
                            className="h-full bg-sky-500 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Apollo 13 Specific Callout: Scope Context */}
                {activeIncident.id === "APOLLO-13" && activeIncident.scope_context && (
                  <div className="bg-sky-950/30 border border-sky-500/45 rounded-xl p-4 flex items-start gap-3 text-xs sm:text-sm text-sky-100">
                    <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-xs font-mono uppercase tracking-wide text-sky-300">
                        Scope Context — Oxygen Tank Fire vs. Cabin Fire
                      </div>
                      <p className="leading-relaxed">{activeIncident.scope_context}</p>
                    </div>
                  </div>
                )}

                {/* Mir Specific Callouts: 3-ft flame, blocked Soyuz route, 2,500+ uses */}
                {activeIncident.id === "MIR-1997" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-[#070B14] border border-orange-500/35 rounded-xl p-3.5 space-y-1">
                      <div className="font-mono text-orange-300 text-lg font-bold">~3 ft flame</div>
                      <div className="text-slate-300">
                        Canister burst into a three-foot flame with sparks, molten metal, and dense smoke.
                      </div>
                    </div>
                    <div className="bg-[#070B14] border border-red-500/35 rounded-xl p-3.5 space-y-1">
                      <div className="font-mono text-red-300 text-lg font-bold">Soyuz blocked</div>
                      <div className="text-slate-300">
                        The flame directly blocked the crew&apos;s path to the docked Soyuz escape vehicle.
                      </div>
                    </div>
                    <div className="bg-[#070B14] border border-amber-500/40 rounded-xl p-3.5 space-y-1">
                      <div className="font-mono text-amber-300 text-lg font-bold">2,500+ uses</div>
                      <div className="text-slate-300">
                        Rare-event risk: the candle type had been used more than 2,500 times without incident.
                      </div>
                    </div>
                  </div>
                )}

                {/* Incident Sub-Tabs */}
                <div
                  role="tablist"
                  aria-label="Incident details tabs"
                  className="flex flex-wrap gap-1.5 bg-[#070B14] border border-slate-800 rounded-lg p-1 w-fit max-w-full"
                >
                  {(
                    [
                      { id: "happened", label: "What happened" },
                      { id: "changed", label: "What changed" },
                      { id: "microgravity", label: "Why it matters for microgravity" },
                    ] as { id: IncidentTab; label: string }[]
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={incidentTab === t.id}
                      onClick={() => setIncidentTab(t.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        incidentTab === t.id
                          ? "bg-amber-500/20 text-amber-200 border border-amber-500/45"
                          : "text-slate-400 hover:text-slate-200 border border-transparent"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab Panels */}
                {incidentTab === "happened" && (
                  <ul className="space-y-2.5">
                    {activeIncident.facts.map((f, i) => (
                      <FactRow key={i} fact={f} integrityRule={integrityRule} />
                    ))}
                  </ul>
                )}

                {incidentTab === "changed" && (
                  <div className="space-y-3">
                    {activeIncident.changes_made && activeIncident.changes_made.length > 0 ? (
                      <>
                        <ul className="space-y-2">
                          {activeIncident.changes_made.map((c, idx) => (
                            <li
                              key={idx}
                              className="bg-[#070B14] border border-slate-800 rounded-lg p-3.5 text-xs sm:text-sm text-slate-200 flex items-start gap-2.5"
                            >
                              <span className="font-mono text-amber-400 text-xs mt-0.5">{idx + 1}.</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                        {activeIncident.changes_source && activeIncident.changes_source.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <SourceQualityBadge
                              quality={isNasaUrl(activeIncident.changes_source[0]) ? "NASA" : "secondary"}
                              integrityRule={integrityRule}
                            />
                            {activeIncident.changes_source.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#070B14] border border-slate-700 text-[11px] font-mono text-sky-300 hover:border-sky-400/70"
                              >
                                <span>{url.replace(/^https?:\/\//, "").split("/")[0]}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-2.5">
                        {activeIncident.facts[3] && (
                          <FactRow fact={activeIncident.facts[3]} integrityRule={integrityRule} />
                        )}
                        <p className="text-xs text-slate-400">
                          Additional changes are documented within the cited review board recommendation above.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {incidentTab === "microgravity" && (
                  <div className="bg-[#070B14] border border-slate-800 rounded-xl p-4 space-y-3 text-xs sm:text-sm text-slate-200">
                    {activeIncident.id === "APOLLO-1" && (
                      <>
                        <div className="font-semibold text-amber-300">
                          Ground test context (1g, not microgravity)
                        </div>
                        <p className="leading-relaxed text-slate-300">
                          {activeIncident.type}. Even at 1g on Earth, a{" "}
                          <span className="font-mono text-slate-100">
                            {activeIncident.environment.atmosphere}
                          </span>{" "}
                          cabin at{" "}
                          <span className="font-mono text-slate-100">
                            {activeIncident.environment.pressure_psi} psi ({activeIncident.environment.pressure_kpa} kPa)
                          </span>{" "}
                          consumed the available oxygen in ~25 seconds. This motivates FlameGuard&apos;s focus on
                          controlling O2 fraction and testing materials under worst-case cabin atmospheres.
                        </p>
                      </>
                    )}
                    {activeIncident.id === "APOLLO-13" && (
                      <>
                        <div className="font-semibold text-sky-300">
                          Microgravity relevance recorded in source
                        </div>
                        <p className="leading-relaxed text-slate-300">
                          {activeIncident.environment.microgravity_relevance}
                        </p>
                        {activeIncident.scope_context && (
                          <p className="leading-relaxed text-slate-200">{activeIncident.scope_context}</p>
                        )}
                      </>
                    )}
                    {activeIncident.id === "MIR-1997" && (
                      <>
                        <div className="font-semibold text-orange-300">
                          In-orbit microgravity fire behavior (Kvant-1, crew {activeIncident.environment.crew})
                        </div>
                        <p className="leading-relaxed text-slate-300">
                          Unlike quiescent candle tests, the SFOG oxygen canister supplied its own oxidizer and threw
                          burning metal globules across the module in microgravity until splattering on the opposite
                          bulkhead, blocking the Soyuz route and producing dense smoke cleared over several hours.
                        </p>
                      </>
                    )}
                    <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setLowerTab("science")}
                        className="px-3 py-1.5 text-xs font-mono bg-[#0D1424] border border-slate-700 rounded text-sky-300 hover:border-sky-400"
                      >
                        View Microgravity Science Links →
                      </button>
                      <button
                        type="button"
                        onClick={() => setLowerTab("takeaways")}
                        className="px-3 py-1.5 text-xs font-mono bg-[#0D1424] border border-slate-700 rounded text-amber-300 hover:border-amber-400"
                      >
                        See Design Takeaways (Interpretation) →
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* 4th Node: Today: ISS and our experiments */
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-sky-400">NODE 04 · CURRENT SPACECRAFT &amp; PSI ARCHIVE</div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-50">
                      Today: ISS and our experiments
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1">
                      How modern ISS oxygen redundancy, extinguisher segments, and NASA PSI experiments (BASS-II,
                      SAFFIRE, FLEX) build on these lessons.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigate("story")}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-slate-950 rounded hover:bg-amber-400"
                    >
                      Open Story (BASS S147)
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate("explore")}
                      className="px-3 py-1.5 text-xs font-medium bg-[#070B14] border border-slate-700 text-slate-100 rounded hover:border-sky-400"
                    >
                      Open Explore Map
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {data.microgravity_fire_science_links.slice(0, 2).map((s, idx) => (
                    <div key={idx} className="bg-[#070B14] border border-slate-800 rounded-lg p-3.5 space-y-2">
                      <p className="text-slate-200 leading-relaxed">{s.link}</p>
                      <div className="flex items-center justify-between gap-2">
                        <SourceQualityBadge
                          quality={isNasaUrl(s.source) ? "NASA" : "secondary"}
                          integrityRule={integrityRule}
                        />
                        <a
                          href={s.source}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:underline font-mono inline-flex items-center gap-1"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Story-Chapter Switcher for Sections 2..6 (keeps page tight and scannable, not an endless scroll) */}
      <section aria-label="Lessons Analysis Chapters" className="space-y-4">
        <div
          role="tablist"
          aria-label="Lessons sections"
          className="flex flex-wrap gap-1.5 bg-[#0D1424] border border-slate-800 rounded-xl p-1.5"
        >
          {(
            [
              { id: "changed", label: "What Changed Comparison" },
              { id: "science", label: "Fire Science Links (4)" },
              { id: "hardware", label: "What Spacecraft Use Today" },
              { id: "takeaways", label: "Design Takeaways (7)" },
              { id: "unknown", label: "What We Do Not Know" },
            ] as { id: LowerSectionTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={lowerTab === tab.id}
              onClick={() => setLowerTab(tab.id)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                lowerTab === tab.id
                  ? "bg-sky-500/20 text-sky-200 border border-sky-500/45"
                  : "text-slate-400 hover:text-slate-100 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 2. "WHAT CHANGED" COMPARISON */}
        {lowerTab === "changed" && (
          <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-50">
                  What Changed Across Incidents
                </h2>
                <p className="text-xs text-slate-400">
                  Click a safety tag to highlight matching changes across Apollo 1, Apollo 13, and Mir.
                </p>
              </div>
              {activeChangeTag && (
                <button
                  type="button"
                  onClick={() => setActiveChangeTag(null)}
                  className="text-xs font-mono text-sky-400 hover:underline self-start sm:self-auto"
                >
                  Clear filter ({activeChangeTag})
                </button>
              )}
            </div>

            {/* Shared Tag Row */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter changes by tag">
              {CHANGE_TAGS.map((tag) => {
                const active = activeChangeTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveChangeTag(active ? null : tag)}
                    aria-pressed={active}
                    className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      active
                        ? "bg-amber-400 text-slate-950 border-amber-300 font-semibold"
                        : "bg-[#070B14] border-slate-700 text-slate-300 hover:border-amber-400/60"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* 3-Column View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[
                {
                  title: "Apollo 1 (1967)",
                  items: apollo1Changes,
                  sourceQuality: apollo1?.changes_source?.[0] && isNasaUrl(apollo1.changes_source[0]) ? "NASA" : "secondary",
                  sourceUrl: apollo1?.changes_source?.[0],
                },
                {
                  title: "Apollo 13 (1970)",
                  items: apollo13Changes,
                  sourceQuality: "NASA",
                  sourceUrl: apollo13?.facts[3]?.source,
                },
                {
                  title: "Mir (1997)",
                  items: mirChanges,
                  sourceQuality: "NASA",
                  sourceUrl: mir1997?.facts[0]?.source,
                },
              ].map((col) => (
                <div
                  key={col.title}
                  className="bg-[#070B14] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2.5">
                    <h3 className="font-display text-sm font-bold text-amber-300 border-b border-slate-800 pb-2">
                      {col.title}
                    </h3>
                    <ul className="space-y-2">
                      {col.items.map((item, idx) => {
                        const matches = !activeChangeTag || item.tags.includes(activeChangeTag);
                        return (
                          <li
                            key={idx}
                            className={`p-2.5 rounded-lg border text-xs leading-relaxed transition-opacity ${
                              matches
                                ? activeChangeTag
                                  ? "bg-amber-500/12 border-amber-400/60 text-slate-100"
                                  : "bg-[#0D1424] border-slate-800 text-slate-200"
                                : "bg-[#090D18] border-slate-900 text-slate-500 opacity-45"
                            }`}
                          >
                            {item.text}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {col.sourceUrl && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <SourceQualityBadge quality={col.sourceQuality} integrityRule={integrityRule} />
                      <a
                        href={col.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-sky-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. "FIRE SCIENCE LINKS" SCENE */}
        {lowerTab === "science" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.microgravity_fire_science_links.map((item, idx) => {
              const isM3 =
                item.link.includes("COMPACT-M3-ISS-THIN-SOLID") || item.link.includes("record M3");
              const isNasa = isNasaUrl(item.source);

              return (
                <div
                  key={idx}
                  className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Mini Visual per card */}
                    <div className="w-24 h-24 shrink-0 rounded-lg bg-[#070B14] border border-slate-800 flex items-center justify-center p-2">
                      {idx === 0 && (
                        <svg viewBox="0 0 90 70" className="w-full h-full" role="img" aria-label="Blue 0g spherical flame vs 1g teardrop flame">
                          {/* Left: 1g teardrop */}
                          <path d="M24 14 C30 26 32 36 24 44 C16 36 18 26 24 14 Z" fill="#F97316" />
                          <rect x="22" y="45" width="4" height="10" fill="#64748B" />
                          <text x="18" y="65" fill="#94A3B8" fontSize="8" fontFamily="monospace">1g</text>
                          {/* Right: 0g sphere */}
                          <circle cx="64" cy="34" r="11" fill="#38BDF8" fillOpacity="0.85" />
                          <circle cx="64" cy="34" r="4" fill="#E0F2FE" />
                          <rect x="62" y="45" width="4" height="10" fill="#64748B" />
                          <text x="58" y="65" fill="#7DD3FC" fontSize="8" fontFamily="monospace">0g</text>
                        </svg>
                      )}
                      {idx === 1 && (
                        <div className="flex flex-col items-center gap-1 text-sky-300">
                          <Fan className="w-8 h-8 text-sky-400" />
                          <span className="font-mono text-[10px] text-slate-300">Flow Dial</span>
                          <div className="w-14 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="w-9 h-full bg-amber-400" />
                          </div>
                        </div>
                      )}
                      {idx === 2 && (
                        <div className="flex flex-col items-center gap-1 text-center">
                          <Wind className="w-6 h-6 text-sky-400" />
                          <span className="font-mono text-xs font-bold text-sky-200">2.2 cm/s</span>
                          <span className="font-mono text-[9px] text-slate-400">Quench @ 18.7% O2</span>
                        </div>
                      )}
                      {idx === 3 && (
                        <svg viewBox="0 0 90 70" className="w-full h-full" role="img" aria-label="Oxygen gauge near 22%">
                          <path d="M15 50 A30 30 0 0 1 75 50" fill="none" stroke="#1E293B" strokeWidth="7" strokeLinecap="round" />
                          <path d="M15 50 A30 30 0 0 1 56 22" fill="none" stroke="#F97316" strokeWidth="7" strokeLinecap="round" />
                          <text x="45" y="49" textAnchor="middle" fill="#FDBA74" fontSize="11" fontFamily="monospace" fontWeight="700">~22%</text>
                          <text x="45" y="62" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="monospace">O2 Gauge</text>
                        </svg>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-mono text-amber-300">
                        SCIENCE LINK 0{idx + 1}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{item.link}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <SourceQualityBadge
                      quality={isNasa ? "NASA" : "secondary"}
                      integrityRule={integrityRule}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {isM3 && (
                        <button
                          type="button"
                          onClick={() => onNavigate("explore", undefined, "COMPACT-M3-ISS-THIN-SOLID")}
                          className="px-2.5 py-1 text-[11px] font-medium bg-sky-500/15 border border-sky-500/45 text-sky-200 rounded hover:bg-sky-500/25 inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                          <Compass className="w-3 h-3" />
                          <span>See this in the Explore map</span>
                        </button>
                      )}
                      <a
                        href={item.source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-sky-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. "WHAT SPACECRAFT USE TODAY" PANEL */}
        {lowerTab === "hardware" && (
          <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-50">
                What Spacecraft Use Today
              </h2>
              <p className="text-xs text-slate-400">
                Current ISS extinguisher hardware and Halon replacement research documented in the sources.
              </p>
            </div>
            <ul className="divide-y divide-slate-800">
              {data.iss_fire_safety_hardware.map((hw, idx) => {
                const isNasa = isNasaUrl(hw.source);
                const Icon = idx === 0 ? Flame : idx === 1 ? Droplets : Sparkles;
                return (
                  <li
                    key={idx}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[#070B14] border border-slate-800 text-sky-400 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{hw.item}.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pl-10 sm:pl-0">
                      <SourceQualityBadge quality={isNasa ? "NASA" : "secondary"} integrityRule={integrityRule} />
                      <a
                        href={hw.source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-sky-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 5. "DESIGN TAKEAWAYS" PANEL */}
        {lowerTab === "takeaways" && (
          <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="bg-amber-950/35 border border-amber-500/50 rounded-xl p-4 space-y-1.5 text-xs">
              <div className="font-semibold text-amber-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{data.design_takeaways.label}</span>
              </div>
              <p className="text-amber-100/90">{data._meta.warning}</p>
            </div>

            <ol className="space-y-3">
              {data.design_takeaways.items.map((t) => (
                <li
                  key={t.id}
                  className="bg-[#070B14] border border-slate-800 rounded-xl p-4 flex flex-col gap-2.5"
                >
                  <div className="flex items-start gap-3">
                    <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-mono text-xs text-amber-300 font-semibold mr-2">{t.id}</span>
                      <span className="text-xs sm:text-sm text-slate-100 leading-relaxed">{t.takeaway}</span>
                    </div>
                  </div>
                  <div className="pl-7 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">Evidence:</span>
                    {t.evidence.map((ev) => (
                      <button
                        key={ev}
                        type="button"
                        onClick={() => handleEvidenceJump(ev)}
                        className="px-2 py-0.5 rounded bg-[#0D1424] border border-slate-700 text-[11px] font-mono text-sky-300 hover:border-amber-400 hover:text-amber-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        title={`Jump to ${ev}`}
                      >
                        {ev} ↗
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 6. "WHAT WE DO NOT KNOW" PANEL */}
        {lowerTab === "unknown" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <h2>Recorded Data Gaps</h2>
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                {data.data_gaps.map((gap, i) => (
                  <li key={i} className="bg-[#070B14] border border-slate-800 rounded-lg p-3 leading-relaxed">
                    {gap}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
                <BookOpenCheck className="w-4 h-4" />
                <h2>Additional Dataset Candidates (Not Yet Loaded)</h2>
              </div>
              <ul className="space-y-2.5">
                {data.additional_dataset_candidates.map((cand) => (
                  <li
                    key={cand.id}
                    className="bg-[#070B14] border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sky-300 font-semibold">{cand.id}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/12 border border-amber-500/40 font-mono text-[11px] text-amber-300">
                        {cand.data_status}
                      </span>
                    </div>
                    <div className="font-medium text-slate-100">{cand.name}</div>
                    <div className="flex items-center justify-between gap-2 text-slate-400">
                      <span>Topic: {cand.topic}</span>
                      <a
                        href={cand.source}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline font-mono inline-flex items-center gap-1"
                      >
                        <span>Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
