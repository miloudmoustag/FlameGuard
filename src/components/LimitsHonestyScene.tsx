import React from "react";
import { AlertTriangle, FileWarning, Flame, ShieldAlert } from "lucide-react";
import { ModelEvaluationReport, OverviewData, PageId } from "../types";

interface Props {
  overview: OverviewData;
  evaluation: ModelEvaluationReport;
  onNavigate?: (page: PageId) => void;
}

export const LimitsHonestyScene: React.FC<Props> = ({ overview, evaluation, onNavigate }) => {
  const missingCount = overview.kpis.missing_observations;
  const presentCount = overview.kpis.observations;
  const totalMeas = missingCount + presentCount;
  const samplePct = Math.round((evaluation.training_records_count / Math.max(1, overview.kpis.experiments)) * 100);

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-800/90 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="font-note text-lg text-amber-300/90">
            Lab Notes · Scientific Honesty &amp; Boundaries
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            Limits &amp; Honesty
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-3xl">
            Every model and dataset in FlameGuard has strict boundaries. Here is exactly what our NASA records support,
            what is missing, and why this tool must never be used for operational flight decisions.
          </p>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("lessons")}
            className="px-3.5 py-2 text-xs font-medium bg-[#0D1424] border border-amber-500/45 text-amber-200 rounded-lg hover:bg-amber-500/10 inline-flex items-center gap-1.5 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Lessons from Fire (Apollo 1, 13 &amp; Mir) →</span>
          </button>
        )}
      </div>

      {/* Prominent Safety Warning */}
      <div className="bg-amber-950/30 border border-amber-500/45 rounded-xl p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm text-amber-100">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-amber-200">
            Never use for spacecraft design or real fire-safety decisions
          </div>
          <p className="text-amber-100/90 leading-relaxed text-xs">
            FlameGuard is a NASA Space Apps 2026 research demonstration prototype. It is NOT peer reviewed and NOT
            equivalent to NASA-STD-6001 material qualification testing or flight-certified CFD safety analysis.
          </p>
        </div>
      </div>

      {/* Four Explicit Limitation Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-mono text-sky-400">01 · SAMPLE SIZE</div>
          <h2 className="text-base font-semibold text-slate-100">
            Small sample size, few experiments represented
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Our demonstration classifier trains on only{" "}
            <span className="font-mono text-sky-300">n = {evaluation.training_records_count}</span> complete-feature NASA
            records ({samplePct}% of {overview.kpis.experiments} cataloged database runs) spanning{" "}
            {evaluation.unique_sample_groups} sample groups. Many spacecraft polymers, thicknesses, geometries, and
            ignition sources are absent.
          </p>
        </div>

        <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-mono text-amber-400">02 · PROOFSHEET MISSINGNESS</div>
          <h2 className="text-base font-semibold text-slate-100">
            ProofSheet PDFs contain no O2% or calibrated flow velocity
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            The uploaded ISS BASS-II ProofSheet PDFs (Samples 160M, 137M, 149M, 176M) confirm timestamps and frame
            counts, but omit oxygen mole fraction and calibrated cm/s airspeed. Those measurements remain SQL{" "}
            <span className="font-mono text-amber-300">NULL</span> (&ldquo;not in source&rdquo;) and are excluded from ML
            training—never guessed or backfilled.
          </p>
        </div>

        <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-mono text-orange-400">03 · SCOPE &amp; RANGE LIMITS</div>
          <h2 className="text-base font-semibold text-slate-100">
            Binary sustained vs. extinction only—no extrapolation
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            The Risk Lab estimates <span className="text-slate-100 font-medium">flame sustained vs. extinction</span>{" "}
            only. It cannot predict fire size, spread speed, heat release, or toxic smoke yield. When user inputs fall
            outside observed NASA bounds ({evaluation.training_ranges.oxygen_pct[0]}–
            {evaluation.training_ranges.oxygen_pct[1]}% O2,{" "}
            {evaluation.training_ranges.flow_velocity_cm_s[0]}–{evaluation.training_ranges.flow_velocity_cm_s[1]} cm/s
            flow, {evaluation.training_ranges.pressure_kpa[0]}–{evaluation.training_ranges.pressure_kpa[1]} kPa), it
            withholds probability completely.
          </p>
        </div>

        <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs font-mono text-emerald-400">04 · REVIEW STATUS</div>
          <h2 className="text-base font-semibold text-slate-100">
            Not peer reviewed · Transparent AI &amp; citations
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Summaries, cross-investigation synthesis, and ML metrics have not undergone peer review. Every finding,
            measurement, and Ask response links back to its NASA PSI, NTRS, or DOI source—and when no Gemini API key is
            active, Q&amp;A clearly runs in Offline Citation Mode.
          </p>
        </div>
      </div>

      {/* Live SQLite Integrity Ledger */}
      <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <FileWarning className="w-4 h-4 text-sky-400" />
          <span>Live Database Provenance &amp; Missingness Audit</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-3">
            <div className="text-slate-400">Cataloged Registry Programs</div>
            <div className="text-xl font-mono font-semibold text-slate-100 mt-0.5 tabular-nums">
              {overview.datasetsRegistry?.length ?? 0}
            </div>
          </div>
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-3">
            <div className="text-slate-400">Complete ML Training Rows</div>
            <div className="text-xl font-mono font-semibold text-sky-300 mt-0.5 tabular-nums">
              n = {evaluation.training_records_count}
            </div>
          </div>
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-3">
            <div className="text-slate-400">Excluded / Incomplete Runs</div>
            <div className="text-xl font-mono font-semibold text-amber-300 mt-0.5 tabular-nums">
              {evaluation.excluded_records_missing_or_nonflaming}
            </div>
          </div>
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-3">
            <div className="text-slate-400">NULL (&ldquo;not in source&rdquo;) Fields</div>
            <div className="text-xl font-mono font-semibold text-orange-300 mt-0.5 tabular-nums">
              {missingCount} / {totalMeas}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Why does this matter? Refusing to fill in missing cells or extrapolate outside training limits protects
            researchers and judges from mistaking sparse demonstration curves for flight-qualified engineering margins.
          </span>
        </div>
      </div>
    </div>
  );
};
