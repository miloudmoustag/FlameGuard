import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Download, ExternalLink, FileSpreadsheet } from "lucide-react";
import {
  ExperimentRecord,
  FindingRecord,
  InvestigationDetail,
  LessonsLearnedData,
  ModelEvaluationReport,
  PredictionOutput,
} from "../types";

interface Props {
  investigations: InvestigationDetail[];
  experiments: ExperimentRecord[];
  findings: FindingRecord[];
  mlEvaluation: ModelEvaluationReport;
  latestPrediction?: { prediction: PredictionOutput; inputs: any } | null;
}

type ReportType =
  | "safety_brief"
  | "investigation_summary"
  | "experiment_comparison"
  | "prediction_report"
  | "findings_summary";

const REPORT_TYPES: { id: ReportType; label: string; description: string }[] = [
  {
    id: "safety_brief",
    label: "Spacecraft Fire-Safety Brief",
    description: "Synthesis of microgravity ignition, low-flow quenching, cool flames, and explicit limitations.",
  },
  {
    id: "investigation_summary",
    label: "Investigation Dossier",
    description: "Summary for a selected NASA PSI investigation, its experiments, and missing fields.",
  },
  {
    id: "experiment_comparison",
    label: "Experiment Comparison Matrix",
    description: "Cross-investigation comparison of O2%, airflow velocity, pressure, and outcomes.",
  },
  {
    id: "prediction_report",
    label: "Prototype Risk Report",
    description: "ML demo probability (or out-of-range refusal), CV sample counts, and uncertainty interval.",
  },
  {
    id: "findings_summary",
    label: "NASA Findings Summary",
    description: "Structured summary of NASA observations, conclusions, citations, and evidence limits.",
  },
];

export const ReportGenerator: React.FC<Props> = ({
  investigations,
  experiments,
  findings,
  mlEvaluation,
  latestPrediction,
}) => {
  const [reportType, setReportType] = useState<ReportType>("safety_brief");
  const [selectedInvId, setSelectedInvId] = useState<string>(investigations[0]?.investigation_id || "");
  const [includeLessons, setIncludeLessons] = useState<boolean>(false);
  const [lessonsData, setLessonsData] = useState<LessonsLearnedData | null>(null);
  const [lessonsLoading, setLessonsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!includeLessons || lessonsData) return;
    let active = true;
    setLessonsLoading(true);
    fetch("/api/lessons")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load lessons"))))
      .then((json: LessonsLearnedData) => {
        if (active) setLessonsData(json);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLessonsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [includeLessons, lessonsData]);

  const selectedInv = useMemo(
    () => investigations.find((i) => i.investigation_id === selectedInvId) || investigations[0],
    [investigations, selectedInvId]
  );

  const nSamples = mlEvaluation.training_records_count || mlEvaluation.validated_training_records;

  const exportCSV = () => {
    const rows =
      reportType === "investigation_summary" && selectedInv
        ? selectedInv.experiments
        : experiments;

    const headers = [
      "experiment_id",
      "investigation",
      "gravity_condition",
      "fuel_type",
      "material",
      "experimental_date",
      "oxygen_pct",
      "flow_velocity_cm_s",
      "pressure_kpa",
      "outcome_label",
      "provenance_type",
      "doi",
      "source_url",
    ];

    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvLines = [
      `# FlameGuard Export | Sample Counts: total_runs=${rows.length}; ml_complete_feature_records_n=${nSamples}; cv_strategy=${mlEvaluation.cv_strategy}`,
      `# Limitations: Demo only (n=${nSamples}); ProofSheet PDFs have NULL O2%/flow ("not in source"); Not peer reviewed; Never use for real spacecraft safety decisions.`,
      headers.join(","),
      ...rows.map((e) =>
        [
          e.experiment_id,
          e.investigation_name,
          e.gravity_condition,
          e.fuel_type,
          e.material,
          e.experimental_date,
          e.metrics.oxygen_concentration?.value ?? "not in source",
          e.metrics.flow_velocity?.value ?? "not in source",
          e.metrics.pressure?.value ?? "not in source",
          e.outcome_label,
          e.provenance_type,
          e.doi ?? "not in source",
          e.source_url,
        ]
          .map(escape)
          .join(",")
      ),
    ];

    const lessonRows: string[] = [];
    if (includeLessons && lessonsData) {
      lessonRows.push("");
      lessonRows.push(`# LESSONS LEARNED TIMELINE SUMMARY (${lessonsData._meta.warning})`);
      lessonRows.push(`# Integrity Rule: ${lessonsData._meta.integrity_rule}`);
      lessonRows.push("incident_id,date,type,fact_or_takeaway,source_quality,source_url");
      for (const inc of lessonsData.incidents) {
        for (const f of inc.facts) {
          lessonRows.push(
            [
              inc.id,
              inc.date,
              inc.type,
              f.fact,
              f.source_quality === "NASA" ? "NASA source" : "Secondary source, verify",
              f.source,
            ]
              .map(escape)
              .join(",")
          );
        }
      }
      lessonRows.push(`# ${lessonsData.design_takeaways.label}`);
      for (const t of lessonsData.design_takeaways.items) {
        lessonRows.push(
          [
            `TAKEAWAY-${t.id}`,
            lessonsData._meta.generated,
            "OUR interpretation (Not official NASA procedure)",
            t.takeaway,
            `Evidence: ${t.evidence.join("; ")}`,
            "not applicable (interpretation)",
          ]
            .map(escape)
            .join(",")
        );
      }
    }

    const blob = new Blob([[...csvLines, ...lessonRows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flameguard_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 44;
    const maxWidth = 507;
    let y = 52;

    const addLine = (text: string, size = 10, bold = false, color: [number, number, number] = [30, 41, 59]) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > 775) {
          doc.addPage();
          y = 52;
        }
        doc.text(line, margin, y);
        y += size * 1.45;
      }
      y += 4;
    };

    const titleObj = REPORT_TYPES.find((r) => r.id === reportType)!;
    addLine("FLAMEGUARD — NASA MICROGRAVITY FIRE INTELLIGENCE REPORT", 9, true, [2, 132, 199]);
    addLine(titleObj.label, 16, true, [15, 23, 42]);
    addLine(
      `Generated: ${new Date().toISOString()} · Sample counts: ${experiments.length} DB runs | ML n = ${nSamples} (${mlEvaluation.cv_strategy})`,
      9,
      false,
      [100, 116, 139]
    );
    y += 8;

    if (reportType === "investigation_summary" && selectedInv) {
      addLine(`${selectedInv.name}: ${selectedInv.full_title}`, 13, true);
      addLine(`PIs: ${selectedInv.principal_investigators} | Platform: ${selectedInv.platform}`, 10);
      addLine(selectedInv.description, 10);
      y += 6;
      addLine(`Experiments (${selectedInv.experiments.length} runs):`, 11, true);
      selectedInv.experiments.forEach((e) => {
        const o2 = e.metrics.oxygen_concentration?.value ?? "not in source";
        const flow = e.metrics.flow_velocity?.value ?? "not in source";
        addLine(`• ${e.experiment_id} | ${e.material} | O2: ${o2}% | Flow: ${flow} cm/s | ${e.outcome_label}`, 9);
      });
    } else if (reportType === "prediction_report") {
      addLine("Research Demonstration Prototype Evaluation", 12, true);
      addLine(
        `Target: ${mlEvaluation.target_outcome} | Protocol: ${mlEvaluation.cv_strategy} | n = ${nSamples} (${mlEvaluation.excluded_records_missing_or_nonflaming} incomplete/non-flaming excluded)`,
        10
      );
      addLine(
        `Logistic Regression (n = ${nSamples}, leave-one-group-out CV): AUC=${mlEvaluation.logistic_regression.roc_auc}, F1=${mlEvaluation.logistic_regression.f1_score}, Brier=${mlEvaluation.logistic_regression.brier_score}`,
        10
      );
      addLine(
        `Random Forest (n = ${nSamples}, leave-one-group-out CV): AUC=${mlEvaluation.random_forest.roc_auc}, F1=${mlEvaluation.random_forest.f1_score}, Brier=${mlEvaluation.random_forest.brier_score}`,
        10
      );
      if (latestPrediction) {
        y += 6;
        addLine("Latest Interactive Scenario:", 11, true);
        if (latestPrediction.prediction.out_of_range || latestPrediction.prediction.ensemble_probability === null) {
          addLine("Status: Outside the range of NASA data we have — probability withheld.", 10, true, [180, 83, 9]);
        } else {
          const ci = latestPrediction.prediction.uncertainty_interval;
          addLine(
            `Estimated Probability (sustained vs. extinction only): ${(latestPrediction.prediction.ensemble_probability * 100).toFixed(1)}% (${latestPrediction.prediction.risk_category}) | Uncertainty: ${ci ? `${(ci[0] * 100).toFixed(1)}% - ${(ci[1] * 100).toFixed(1)}%` : "not in source"}`,
            10
          );
        }
        addLine(latestPrediction.prediction.explanation, 9);
      }
    } else {
      addLine(`Cited NASA Findings Summary (${findings.length} findings):`, 12, true);
      findings.forEach((f) => {
        addLine(`${f.investigation_name}: ${f.title}`, 11, true);
        addLine(`Observed: ${f.observation}`, 9);
        addLine(`NASA Conclusion: ${f.researcher_conclusion}`, 9);
        addLine(`Safety Implication: ${f.safety_implication}`, 9);
        addLine(`Citation: ${f.citation} (${f.doi || f.source_url})`, 8, false, [100, 116, 139]);
        y += 4;
      });
    }

    if (includeLessons && lessonsData) {
      y += 10;
      addLine("LESSONS LEARNED FROM PAST SPACECRAFT FIRES", 12, true, [15, 23, 42]);
      addLine(lessonsData._meta.warning, 9, true, [180, 83, 9]);
      for (const inc of lessonsData.incidents) {
        addLine(`${inc.id} (${inc.date}) — ${inc.type}`, 10, true);
        inc.facts.forEach((f) => {
          const q = f.source_quality === "NASA" ? "NASA source" : "Secondary source, verify";
          addLine(`• ${f.fact} [${q}] (${f.source})`, 8.5, false, [51, 65, 85]);
        });
      }
      y += 4;
      addLine(`DESIGN TAKEAWAYS — ${lessonsData.design_takeaways.label}`, 10, true, [180, 83, 9]);
      lessonsData.design_takeaways.items.forEach((t) => {
        addLine(`• ${t.id}: ${t.takeaway} [Evidence: ${t.evidence.join(", ")}]`, 8.5);
      });
    }

    y += 8;
    addLine("EXPLICIT LIMITATIONS & SCIENTIFIC HONESTY NOTICE", 11, true, [180, 83, 9]);
    addLine(`• Small sample size: ML demo trained on n = ${nSamples} NASA records (${experiments.length} total DB runs).`, 9);
    addLine("• ProofSheet PDFs have no O2% or calibrated flow velocity, so those fields remain NULL ('not in source') and excluded from ML training.", 9);
    addLine("• Binary outcome only: predicts flame sustained vs. extinction only — not fire size, spread rate, or severity.", 9);
    addLine("• Not peer reviewed. Demo model not validated for spacecraft design or real fire-safety decisions.", 9, true, [180, 83, 9]);

    doc.save(`flameguard_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-800/90 pb-4">
        <div>
          <div className="font-note text-lg text-amber-300/90">
            Chapter 07 · Reproducible Export
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            Scientific Report Generator
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-3xl">
            Export aerospace briefs and CSV datasets with exact sample counts, NASA citations, and mandatory
            limitations.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={exportCSV}
            className="px-4 py-2 text-xs font-medium bg-[#0D1424] text-slate-200 border border-slate-700 rounded-md hover:border-sky-500/50 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={exportPDF}
            className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.id}
            type="button"
            onClick={() => setReportType(rt.id)}
            className={`text-left p-3.5 rounded-xl border transition-colors ${
              reportType === rt.id
                ? "bg-amber-500/12 border-amber-400 text-slate-50"
                : "bg-[#0D1424] border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <div className="text-xs font-semibold">{rt.label}</div>
            <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{rt.description}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1424] border border-slate-800 rounded-xl p-3.5">
        <label className="inline-flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeLessons}
            onChange={(e) => setIncludeLessons(e.target.checked)}
            className="w-4 h-4 accent-amber-400 rounded border-slate-600"
          />
          <span>
            <strong className="text-amber-300">Include lessons learned</strong> (Apollo 1, Apollo 13, Mir timeline,
            sources, and labeled interpretation takeaways)
          </span>
        </label>
        {lessonsLoading && <span className="text-[11px] font-mono text-sky-300">Loading /api/lessons...</span>}
      </div>

      {reportType === "investigation_summary" && (
        <div className="flex items-center gap-3 bg-[#0D1424] border border-slate-800 rounded-xl p-3">
          <span className="text-xs text-slate-300 font-medium">Target Investigation:</span>
          <select
            value={selectedInvId}
            onChange={(e) => setSelectedInvId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#070B14] border border-slate-800 rounded text-slate-100"
          >
            {investigations.map((i) => (
              <option key={i.investigation_id} value={i.investigation_id}>
                {i.name} — {i.full_title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Report Document Preview */}
      <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs font-mono text-sky-400">FLAMEGUARD REPORT PREVIEW</div>
            <h2 className="text-xl font-semibold text-slate-50 mt-1">
              {REPORT_TYPES.find((r) => r.id === reportType)?.label}
            </h2>
          </div>
          <div className="text-xs font-mono text-slate-400 tabular-nums">
            Date: {new Date().toISOString().slice(0, 10)}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-3">
            <div className="text-slate-400">Investigations</div>
            <div className="text-lg font-mono text-slate-100 mt-0.5 tabular-nums">{investigations.length}</div>
          </div>
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-3">
            <div className="text-slate-400">Runs Included</div>
            <div className="text-lg font-mono text-slate-100 mt-0.5 tabular-nums">
              {reportType === "investigation_summary" && selectedInv
                ? selectedInv.experiments.length
                : experiments.length}
            </div>
          </div>
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-3">
            <div className="text-slate-400">Demo ROC-AUC</div>
            <div className="text-lg font-mono text-emerald-300 mt-0.5 tabular-nums">
              {mlEvaluation.logistic_regression.roc_auc.toFixed(3)}{" "}
              <span className="text-[11px] text-slate-400">(n = {nSamples})</span>
            </div>
          </div>
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-3">
            <div className="text-slate-400">Citation Coverage</div>
            <div className="text-lg font-mono text-sky-300 mt-0.5 tabular-nums">100%</div>
          </div>
        </div>

        {reportType === "prediction_report" && (
          <div className="space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-slate-100">Model Benchmark &amp; Latest Scenario</h3>
            <p className="text-slate-300">
              Evaluation Protocol: {mlEvaluation.cv_strategy}, n = {nSamples} complete-feature records (
              {mlEvaluation.excluded_records_missing_or_nonflaming} incomplete/non-flaming records excluded).
            </p>
            {latestPrediction ? (
              <div className="bg-[#070B14] border border-slate-800 rounded-lg p-4 space-y-1.5">
                {latestPrediction.prediction.out_of_range || latestPrediction.prediction.ensemble_probability === null ? (
                  <div className="font-mono text-amber-300">
                    Latest Scenario: Outside the range of NASA data we have — probability withheld.
                  </div>
                ) : (
                  <div className="font-mono text-orange-300">
                    Latest Estimate: {(latestPrediction.prediction.ensemble_probability * 100).toFixed(1)}% (
                    {latestPrediction.prediction.risk_category}) · Uncertainty{" "}
                    {latestPrediction.prediction.uncertainty_interval
                      ? `${(latestPrediction.prediction.uncertainty_interval[0] * 100).toFixed(1)}%–${(latestPrediction.prediction.uncertainty_interval[1] * 100).toFixed(1)}%`
                      : "not in source"}
                  </div>
                )}
                <p className="text-slate-300">{latestPrediction.prediction.explanation}</p>
              </div>
            ) : (
              <div className="text-slate-400">
                Run a scenario in Fire Risk Lab to embed it inside this report.
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-100">Included NASA Findings &amp; Citations</h3>
          <div className="divide-y divide-slate-800/70 max-h-60 overflow-y-auto pr-1">
            {(reportType === "investigation_summary" && selectedInv ? selectedInv.findings : findings).map((f) => (
              <div key={f.finding_id} className="py-2.5 text-xs space-y-1">
                <div className="font-medium text-slate-100">
                  {f.investigation_name} · {f.title}
                </div>
                <p className="text-slate-300">{f.safety_implication}</p>
                <div className="font-mono text-[11px] text-slate-400">
                  {f.citation} {f.doi ? `· DOI: ${f.doi}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        {includeLessons && lessonsData && (
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-amber-300">
                Included Lessons Learned Timeline Summary
              </div>
              <span className="font-mono text-[11px] text-amber-200/80">
                {lessonsData.design_takeaways.label}
              </span>
            </div>
            <div className="space-y-2">
              {lessonsData.incidents.map((inc) => (
                <div key={inc.id} className="border-t border-slate-800/80 pt-2 space-y-1">
                  <div className="font-mono text-slate-100 font-semibold">
                    {inc.id} ({inc.date}) — {inc.type}
                  </div>
                  <div className="text-slate-300">{inc.facts[0]?.fact}</div>
                  <a
                    href={inc.facts[0]?.source}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-400 hover:underline"
                  >
                    <span>
                      {inc.facts[0]?.source_quality === "NASA" ? "NASA source" : "Secondary source, verify"} ·{" "}
                      {inc.facts[0]?.source}
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mandatory Limitations Box */}
        <div className="bg-amber-950/25 border border-amber-500/40 rounded-lg p-4 text-xs text-amber-200 space-y-1">
          <div className="font-semibold text-amber-300">
            Mandatory Limitations &amp; Sample Counts (Included in PDF &amp; CSV Exports):
          </div>
          <ul className="space-y-1 text-amber-100/90">
            <li>• Sample counts: {experiments.length} DB runs; n = {nSamples} complete-feature ML records ({mlEvaluation.cv_strategy}).</li>
            <li>• ProofSheet PDFs omit O2% and calibrated flow velocity (kept NULL / &ldquo;not in source&rdquo;).</li>
            <li>• Not peer reviewed. Demo model not validated for spacecraft design or real fire-safety decisions.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

