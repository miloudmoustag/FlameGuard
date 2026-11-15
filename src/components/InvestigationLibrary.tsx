import React, { useEffect, useState } from "react";
import { Database, ExternalLink, FileText, Play } from "lucide-react";
import { DatasetRegistryEntry, DocumentRecord, InvestigationDetail, PageId } from "../types";
import { DataSourcesManager } from "./DataSourcesManager";

interface Props {
  investigations: InvestigationDetail[];
  datasetsRegistry: DatasetRegistryEntry[];
  documents: DocumentRecord[];
  initialInvestigationId?: string;
  onNavigate: (page: PageId) => void;
  onDataImported: () => void;
}

export const InvestigationLibrary: React.FC<Props> = ({
  investigations,
  datasetsRegistry,
  documents,
  initialInvestigationId,
  onNavigate,
  onDataImported,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    initialInvestigationId || investigations[0]?.investigation_id || ""
  );
  const [showImporter, setShowImporter] = useState(false);
  const [activeAsset, setActiveAsset] = useState<{
    title: string;
    path: string;
    type: "video" | "pdf";
  } | null>(null);

  useEffect(() => {
    if (initialInvestigationId) setSelectedId(initialInvestigationId);
  }, [initialInvestigationId]);

  const active =
    investigations.find((i) => i.investigation_id === selectedId) || investigations[0];

  if (!active) return null;

  const assetExperiments = active.experiments.filter((e) => e.local_asset_path);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-800/90 pb-4">
        <div>
          <div className="font-note text-lg text-amber-300/90">
            Chapter 06 · NASA Mission Catalog &amp; Flight Artifacts
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            NASA Investigation Library
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-3xl">
            Browse imported NASA PSI investigations, primary ISS ProofSheets &amp; video, and the 15-program{" "}
            <span className="font-mono text-sky-300">datasets_registry</span> (including newly cataloged missions awaiting CSV import).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowImporter((s) => !s)}
          className="px-3.5 py-2 text-xs font-medium bg-[#0D1424] border border-slate-700 rounded-md text-slate-200 hover:border-amber-400/60 inline-flex items-center gap-1.5 w-fit shrink-0"
        >
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span>{showImporter ? "Back to Library" : "Import NASA PSI CSV / JSON"}</span>
        </button>
      </div>

      {showImporter ? (
        <DataSourcesManager
          documents={documents}
          investigations={investigations}
          onDataImported={() => {
            onDataImported();
            setShowImporter(false);
          }}
        />
      ) : (
        <>
          {/* Compact Seed Registry Table (Shows NEW datasets + data not yet imported status) */}
          {datasetsRegistry.length > 0 && (
            <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    NASA Datasets Registry ({datasetsRegistry.length} Cataloged Programs)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Loaded directly from <span className="font-mono">flameguard_compact_seed.json</span> — click any
                    row to inspect details. Programs with 0 runs honestly read &ldquo;data not yet imported&rdquo;.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {datasetsRegistry.map((reg) => {
                  const isNew = reg.status === "NEW";
                  const hasData = reg.experiment_count > 0;
                  const isSelected = reg.investigation_id === active.investigation_id;

                  return (
                    <div
                      key={reg.id}
                      onClick={() => {
                        if (reg.investigation_id) {
                          setSelectedId(reg.investigation_id);
                          setActiveAsset(null);
                        }
                      }}
                      className={`p-3 rounded-lg border text-xs transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? "bg-sky-500/12 border-sky-400/70"
                          : "bg-[#070B14] border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-slate-100">{reg.id}</span>
                          {isNew && (
                            <span className="font-mono text-[10px] font-bold tracking-wider text-amber-300 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="text-slate-200 font-medium line-clamp-1">{reg.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {reg.platform} · {reg.topic}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                        <span className={hasData ? "text-emerald-300" : "text-amber-300/90"}>
                          {hasData ? `${reg.experiment_count} runs imported` : "data not yet imported"}
                        </span>
                        <a
                          href={reg.source}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sky-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Investigation Dossier */}
          <div className="bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1.5">
                <div className="text-xs font-mono text-sky-400">
                  {active.investigation_id} · {active.research_area}
                </div>
                <h2 className="text-xl font-semibold text-slate-50">
                  {active.name}: {active.full_title}
                </h2>
                <div className="text-xs text-slate-400">
                  Investigators: <span className="text-slate-200">{active.principal_investigators}</span> · Platform:{" "}
                  <span className="text-slate-200">{active.platform}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <a
                  href={active.nasa_source}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs bg-[#070B14] border border-slate-700 rounded text-slate-200 hover:border-sky-500/50 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>NASA PSI Source</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {active.doi && (
                  <a
                    href={`https://doi.org/${active.doi}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs bg-sky-500/15 border border-sky-500/40 rounded text-sky-300 hover:bg-sky-500/25 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>DOI: {active.doi}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">{active.description}</p>

            {/* Primary Uploaded NASA Flight Assets (if present, e.g., BASS-II ProofSheets & MP4 Video) */}
            {assetExperiments.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="text-sm font-semibold text-slate-100">
                  Primary ISS Flight Artifacts ({assetExperiments.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {assetExperiments.map((exp) => {
                    const isVideo = exp.local_asset_path?.endsWith(".mp4");
                    return (
                      <div
                        key={exp.experiment_id}
                        className="bg-[#070B14] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-mono text-sky-300 font-medium">{exp.experiment_id}</div>
                          <div className="text-xs text-slate-200 font-medium mt-1">{exp.material}</div>
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">{exp.experiment_description}</div>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                          <span className="text-[11px] font-mono text-slate-400">{exp.experimental_date}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveAsset({
                                title: `${exp.experiment_id} — ${exp.material}`,
                                path: exp.local_asset_path!,
                                type: isVideo ? "video" : "pdf",
                              })
                            }
                            className="px-2.5 py-1 text-xs bg-sky-500/15 text-sky-300 border border-sky-500/40 rounded hover:bg-sky-500/25 inline-flex items-center gap-1.5"
                          >
                            {isVideo ? <Play className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                            <span>{isVideo ? "Play Video" : "View ProofSheet"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeAsset && (
                  <div className="border border-sky-500/40 rounded-lg bg-[#070B14] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono text-sky-300 font-semibold">{activeAsset.title}</div>
                      <div className="flex items-center gap-3">
                        <a
                          href={activeAsset.path}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-300 hover:text-sky-300 underline"
                        >
                          Open File
                        </a>
                        <button
                          type="button"
                          onClick={() => setActiveAsset(null)}
                          className="text-xs text-slate-400 hover:text-slate-200"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    {activeAsset.type === "video" ? (
                      <video
                        src={activeAsset.path}
                        controls
                        className="w-full max-h-[380px] rounded bg-black border border-slate-800"
                      />
                    ) : (
                      <iframe
                        src={activeAsset.path}
                        title={activeAsset.title}
                        className="w-full h-[460px] rounded bg-white border border-slate-800"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Associated Experiments & Findings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2 border-t border-slate-800/80">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Imported Runs ({active.experiments.length})
                  </h3>
                  {active.experiments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate("compare")}
                      className="text-xs text-sky-400 hover:text-sky-300"
                    >
                      Compare Runs
                    </button>
                  )}
                </div>
                {active.experiments.length === 0 ? (
                  <div className="bg-[#070B14] border border-dashed border-slate-800 rounded-lg p-5 text-xs text-slate-400 space-y-2">
                    <div className="font-mono text-amber-300">Status: data not yet imported</div>
                    <p>
                      This NASA PSI program is registered in our catalog, but no numeric experimental test points have
                      been imported yet. Upload a PSI CSV/JSON file to populate runs here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70 max-h-72 overflow-y-auto pr-1">
                    {active.experiments.map((e) => (
                      <div key={e.experiment_id} className="py-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sky-300 font-medium">{e.experiment_id}</span>
                          <span
                            className={
                              e.sustained_combustion === 1
                                ? "text-orange-300"
                                : e.sustained_combustion === 0
                                ? "text-sky-300"
                                : "text-amber-300"
                            }
                          >
                            {e.outcome_label}
                          </span>
                        </div>
                        <div className="text-slate-300">
                          {e.material} · {e.gravity_condition} · O2:{" "}
                          {e.metrics.oxygen_concentration?.value ?? "not in source"}
                          {e.metrics.oxygen_concentration?.value != null ? "%" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Cited Findings ({active.findings.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigate("explore")}
                    className="text-xs text-sky-400 hover:text-sky-300"
                  >
                    Explore All Findings
                  </button>
                </div>
                {active.findings.length === 0 ? (
                  <div className="bg-[#070B14] border border-dashed border-slate-800 rounded-lg p-5 text-xs text-slate-400">
                    No findings extracted for this catalog entry yet. Visit the external NASA source link above to review
                    published program documentation.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {active.findings.map((f) => (
                      <div key={f.finding_id} className="bg-[#070B14] border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                        <div className="font-medium text-slate-100">{f.title}</div>
                        <p className="text-slate-300 leading-relaxed">{f.researcher_conclusion}</p>
                        <div className="text-[11px] font-mono text-slate-400">{f.citation}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

