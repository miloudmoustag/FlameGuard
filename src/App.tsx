import React, { Suspense, useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  Archive,
  Compass,
  FileBarChart2,
  Flame,
  GitCompare,
  History,
  MessageSquareText,
  PlayCircle,
  Scale,
  ShieldAlert,
} from "lucide-react";
import {
  DocumentRecord,
  ExperimentRecord,
  FindingRecord,
  InvestigationDetail,
  OverviewData,
  PageId,
  PredictionOutput,
} from "./types";
import { HeroScene } from "./components/HeroScene";

const StoryScene = React.lazy(() =>
  import("./components/StoryScene").then((m) => ({ default: m.StoryScene }))
);
const ExploreScene = React.lazy(() =>
  import("./components/ExploreScene").then((m) => ({ default: m.ExploreScene }))
);
const ExperimentComparisonLab = React.lazy(() =>
  import("./components/ExperimentComparisonLab").then((m) => ({
    default: m.ExperimentComparisonLab,
  }))
);
const FireRiskPredictionLab = React.lazy(() =>
  import("./components/FireRiskPredictionLab").then((m) => ({
    default: m.FireRiskPredictionLab,
  }))
);
const AiResearchAssistant = React.lazy(() =>
  import("./components/AiResearchAssistant").then((m) => ({
    default: m.AiResearchAssistant,
  }))
);
const InvestigationLibrary = React.lazy(() =>
  import("./components/InvestigationLibrary").then((m) => ({
    default: m.InvestigationLibrary,
  }))
);
const LessonsFromFireScene = React.lazy(() =>
  import("./components/LessonsFromFireScene").then((m) => ({
    default: m.LessonsFromFireScene,
  }))
);
const ReportGenerator = React.lazy(() =>
  import("./components/ReportGenerator").then((m) => ({ default: m.ReportGenerator }))
);
const LimitsHonestyScene = React.lazy(() =>
  import("./components/LimitsHonestyScene").then((m) => ({
    default: m.LimitsHonestyScene,
  }))
);

interface NavItem {
  id: PageId;
  label: string;
  mobileLabel: string;
  chapter: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "story", label: "Story", mobileLabel: "Story", chapter: "01 · S147 Walk", icon: PlayCircle },
  { id: "explore", label: "Explore", mobileLabel: "Explore", chapter: "02 · Flame Map", icon: Compass },
  { id: "compare", label: "Compare", mobileLabel: "Compare", chapter: "03 · 0g vs 1g", icon: GitCompare },
  { id: "prediction", label: "Risk Lab", mobileLabel: "Risk", chapter: "04 · Demo Model", icon: ShieldAlert },
  { id: "ask", label: "Ask", mobileLabel: "Ask", chapter: "05 · Notebook Q&A", icon: MessageSquareText },
  { id: "library", label: "Library", mobileLabel: "Library", chapter: "06 · NASA Seed", icon: Archive },
  { id: "lessons", label: "Lessons", mobileLabel: "Lessons", chapter: "06B · Past Fires", icon: History },
  { id: "report", label: "Report", mobileLabel: "Report", chapter: "07 · Export", icon: FileBarChart2 },
  { id: "limits", label: "Limits", mobileLabel: "Limits", chapter: "08 · Honesty", icon: Scale },
];

function SceneSkeleton() {
  return (
    <div className="space-y-4 py-6" aria-busy="true" aria-label="Loading scene">
      <div className="h-7 w-64 bg-slate-800/70 rounded animate-pulse" />
      <div className="h-4 w-96 max-w-full bg-slate-800/50 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {[1, 2, 3].map((k) => (
          <div key={k} className="h-36 bg-[#0D1424] border border-slate-800 rounded-xl" />
        ))}
      </div>
      <div className="h-72 bg-[#0D1424] border border-slate-800 rounded-xl" />
    </div>
  );
}

export default function App() {
  const [showHero, setShowHero] = useState(true);
  const [activePage, setActivePage] = useState<PageId>("story");
  const [libraryInvId, setLibraryInvId] = useState<string | undefined>(undefined);
  const [exploreHighlightId, setExploreHighlightId] = useState<string | undefined>(undefined);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [investigations, setInvestigations] = useState<InvestigationDetail[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [latestPrediction, setLatestPrediction] = useState<{
    prediction: PredictionOutput;
    inputs: any;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, invRes, expRes, findRes, docRes] = await Promise.all([
        fetch("/api/overview"),
        fetch("/api/investigations"),
        fetch("/api/experiments"),
        fetch("/api/findings"),
        fetch("/api/documents"),
      ]);
      if (!ovRes.ok || !invRes.ok || !expRes.ok || !findRes.ok || !docRes.ok) {
        throw new Error("Failed to fetch FlameGuard research repository from backend.");
      }
      const [ovJson, invJson, expJson, findJson, docJson] = await Promise.all([
        ovRes.json(),
        invRes.json(),
        expRes.json(),
        findRes.json(),
        docRes.json(),
      ]);
      setOverview(ovJson);
      setInvestigations(invJson.investigations || []);
      setExperiments(expJson.experiments || []);
      setFindings(findJson.findings || []);
      setDocuments(docJson.documents || []);
    } catch (e: any) {
      setError(e.message || "Unable to connect to FlameGuard backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleNavigate = (page: PageId, investigationId?: string, experimentId?: string) => {
    if (investigationId) setLibraryInvId(investigationId);
    if (experimentId) setExploreHighlightId(experimentId);
    setActivePage(page);
    setShowHero(false);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  if (showHero) {
    return (
      <MotionConfig reducedMotion="user">
        <HeroScene
          onStartInvestigation={() => {
            setActivePage("story");
            setShowHero(false);
          }}
          stats={
            overview
              ? {
                  experiments: overview.kpis.experiments,
                  investigations: overview.kpis.investigations,
                  findings: overview.kpis.findings,
                }
              : undefined
          }
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#070B14] text-slate-100 flex">
        {/* Desktop Left Rail */}
        <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0A101E] border-r border-slate-800/90 z-30">
          <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800/90">
            <button
              type="button"
              onClick={() => setShowHero(true)}
              className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded px-1 py-0.5"
              title="Return to 1g vs 0g Interactive Opener"
            >
              <Flame className="w-5 h-5 text-orange-400 shrink-0" />
              <span className="font-display text-base font-bold tracking-tight text-slate-50 whitespace-nowrap">
                FlameGuard
              </span>
            </button>
          </div>

          <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    active
                      ? "bg-amber-500/12 text-amber-200 border border-amber-500/35"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? "text-amber-400" : "text-slate-400"}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">{item.chapter}</div>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800/90 space-y-1.5">
            <div className="font-note text-base text-amber-300 leading-none">
              Flame in Freefall
            </div>
            <div className="text-[11px] text-slate-400">
              NASA Space Apps 2026
            </div>
            <button
              type="button"
              onClick={() => setShowHero(true)}
              className="text-[11px] font-mono text-sky-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
            >
              ↺ Replay 1g vs 0g Flame
            </button>
          </div>
        </aside>

        {/* Main Content Column */}
        <div className="flex-1 lg:pl-56 flex flex-col min-w-0">
          {/* Compact Top Bar */}
          <header className="h-14 sticky top-0 z-20 bg-[#070B14]/95 backdrop-blur border-b border-slate-800/90 px-4 lg:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setShowHero(true)}
                className="lg:hidden flex items-center gap-1.5 text-slate-100 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                aria-label="Return to FlameGuard 1g vs 0g intro"
              >
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="font-display text-sm font-bold">FlameGuard</span>
              </button>
              <span className="text-slate-600 lg:hidden" aria-hidden="true">/</span>
              <span className="text-xs font-mono text-amber-300/90 hidden sm:inline shrink-0">
                {activeNav.chapter}
              </span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
              <span className="text-xs sm:text-sm font-medium text-slate-100 truncate">
                {activeNav.label}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {overview && (
                <span className="hidden md:inline text-xs font-mono text-slate-400 tabular-nums">
                  {overview.kpis.experiments} NASA records · n={overview.mlReport.training_records_count} ML
                </span>
              )}
              <button
                type="button"
                onClick={() => handleNavigate("limits")}
                className="px-2.5 py-1 text-[11px] font-mono bg-[#0D1424] text-amber-200 border border-amber-500/35 rounded hover:bg-amber-500/10 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Limits &amp; Honesty
              </button>
            </div>
          </header>

          {/* Main Viewport (padded at bottom on mobile for fixed dock) */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-10 max-w-[1380px] w-full mx-auto">
            {loading ? (
              <SceneSkeleton />
            ) : error || !overview ? (
              <div className="bg-[#0D1424] border border-red-500/40 rounded-xl p-6 text-sm text-red-300 space-y-3">
                <div>{error || "Unable to load FlameGuard workspace."}</div>
                <button
                  type="button"
                  onClick={fetchAllData}
                  className="px-4 py-2 text-xs bg-red-500/20 border border-red-500/40 rounded text-red-200 hover:bg-red-500/30"
                >
                  Retry Connection
                </button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePage}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <Suspense fallback={<SceneSkeleton />}>
                    {activePage === "story" && (
                      <StoryScene telemetry={overview.s147Telemetry} onNavigate={handleNavigate} />
                    )}
                    {activePage === "explore" && (
                      <ExploreScene
                        experiments={experiments}
                        findings={findings}
                        initialExperimentId={exploreHighlightId}
                      />
                    )}
                    {activePage === "compare" && (
                      <ExperimentComparisonLab experiments={experiments} />
                    )}
                    {activePage === "prediction" && (
                      <FireRiskPredictionLab
                        evaluation={overview.mlReport}
                        onPredictionGenerated={(prediction, inputs) =>
                          setLatestPrediction({ prediction, inputs })
                        }
                        onNavigate={handleNavigate}
                      />
                    )}
                    {activePage === "ask" && <AiResearchAssistant />}
                    {activePage === "library" && (
                      <InvestigationLibrary
                        investigations={investigations}
                        datasetsRegistry={overview.datasetsRegistry}
                        documents={documents}
                        initialInvestigationId={libraryInvId}
                        onNavigate={handleNavigate}
                        onDataImported={fetchAllData}
                      />
                    )}
                    {activePage === "lessons" && (
                      <LessonsFromFireScene onNavigate={handleNavigate} />
                    )}
                    {activePage === "report" && (
                      <ReportGenerator
                        investigations={investigations}
                        experiments={experiments}
                        findings={findings}
                        mlEvaluation={overview.mlReport}
                        latestPrediction={latestPrediction}
                      />
                    )}
                    {activePage === "limits" && (
                      <LimitsHonestyScene
                        overview={overview}
                        evaluation={overview.mlReport}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>

        {/* Mobile Bottom Dock (380px+ safe: 5-column crisp grid fits all 9 destinations without horizontal overflow) */}
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0A101E]/95 backdrop-blur border-t border-slate-800 px-1 py-1.5"
        >
          <div className="grid grid-cols-5 gap-1 max-w-lg mx-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-md text-[10px] leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    active
                      ? "bg-amber-500/15 text-amber-200 border border-amber-500/35"
                      : "text-slate-400 hover:text-slate-100 border border-transparent"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mb-0.5 ${active ? "text-amber-400" : ""}`} />
                  <span className="truncate max-w-full font-medium">{item.mobileLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </MotionConfig>
  );
}
