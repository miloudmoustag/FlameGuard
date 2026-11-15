import React, { useState } from "react";
import { CheckCircle2, ExternalLink, Upload } from "lucide-react";
import { DocumentRecord, InvestigationDetail } from "../types";

interface Props {
  documents: DocumentRecord[];
  investigations: InvestigationDetail[];
  onDataImported: () => void;
}

function parseDelimitedText(text: string, delimiter: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      const raw = vals[idx];
      obj[h] = raw === "" || raw === undefined || raw.toLowerCase() === "null" || raw.toLowerCase() === "nan" ? null : raw;
    });
    return {
      experiment_id: obj.experiment_id || obj.test_point || undefined,
      sample_group: obj.sample_group || obj.sample_id || undefined,
      description: obj.description || obj.experiment_description || undefined,
      gravity_condition: obj.gravity_condition || obj.gravity || "Microgravity",
      fuel_type: obj.fuel_type || "Solid Polymer",
      material: obj.material || obj.fuel || "Unspecified",
      experimental_date: obj.experimental_date || obj.date || undefined,
      outcome_label: obj.outcome_label || obj.outcome || undefined,
      sustained_combustion:
        obj.sustained_combustion !== null && obj.sustained_combustion !== undefined
          ? Number(obj.sustained_combustion)
          : null,
      oxygen_pct:
        obj.oxygen_pct !== null && obj.oxygen_pct !== undefined
          ? Number(obj.oxygen_pct)
          : obj.o2 !== undefined && obj.o2 !== null
          ? Number(obj.o2)
          : null,
      flow_velocity_cm_s:
        obj.flow_velocity_cm_s !== null && obj.flow_velocity_cm_s !== undefined
          ? Number(obj.flow_velocity_cm_s)
          : obj.flow !== undefined && obj.flow !== null
          ? Number(obj.flow)
          : null,
      pressure_kpa:
        obj.pressure_kpa !== null && obj.pressure_kpa !== undefined
          ? Number(obj.pressure_kpa)
          : obj.pressure !== undefined && obj.pressure !== null
          ? Number(obj.pressure)
          : null,
      temperature_c:
        obj.temperature_c !== null && obj.temperature_c !== undefined ? Number(obj.temperature_c) : null,
    };
  });
}

export const DataSourcesManager: React.FC<Props> = ({ documents, investigations, onDataImported }) => {
  const [title, setTitle] = useState("");
  const [investigationId, setInvestigationId] = useState(investigations[0]?.investigation_id || "PSI-25-BASS-II");
  const [sourceUrl, setSourceUrl] = useState("https://psi.nasa.gov/physci/repo/search?q=combustion");
  const [fileFormat, setFileFormat] = useState("CSV");
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    setTitle(file.name);

    try {
      const content = await file.text();
      if (ext === "json") {
        setFileFormat("JSON");
        const parsed = JSON.parse(content);
        const arr = Array.isArray(parsed) ? parsed : parsed.experiments || parsed.records || [];
        setParsedRecords(arr);
      } else if (ext === "tsv") {
        setFileFormat("TSV");
        setParsedRecords(parseDelimitedText(content, "\t"));
      } else {
        setFileFormat("CSV");
        setParsedRecords(parseDelimitedText(content, ","));
      }
    } catch (err: any) {
      setStatusMsg(`Failed to parse file: ${err.message}`);
      setParsedRecords([]);
    }
  };

  const submitImport = async () => {
    if (parsedRecords.length === 0) return;
    setImporting(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Imported NASA PSI Dataset",
          investigation_id: investigationId,
          file_format: fileFormat,
          source_url: sourceUrl,
          records: parsedRecords,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setStatusMsg(
        `Ingested ${json.imported_records} records into SQLite and retrained ML prototype (n = ${json.ml_evaluation?.training_records_count ?? json.ml_evaluation?.validated_training_records} complete-feature records).`
      );
      setParsedRecords([]);
      setTitle("");
      onDataImported();
    } catch (err: any) {
      setStatusMsg(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-semibold text-slate-50">Data Source Management & Ingestion Pipeline</h1>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">
          Track provenance, unit normalization, and missing-value audits across all imported NASA PSI datasets and
          uploaded ISS flight artifacts. Import additional NASA PSI CSV, TSV, or JSON exports directly into SQLite.
        </p>
      </div>

      {/* Live Importer + Colab/Python Pipeline Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-[#0D1424] border border-slate-800 rounded-md p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Upload className="w-4 h-4 text-sky-400" />
            <span>Import NASA PSI Dataset (CSV / TSV / JSON)</span>
          </div>
          <p className="text-xs text-slate-400">
            Expected columns (optional fields default safely; missing numeric cells remain NULL without fabrication):{" "}
            <code className="text-sky-300">
              experiment_id, sample_group, gravity_condition, material, oxygen_pct, flow_velocity_cm_s, pressure_kpa,
              temperature_c, outcome_label, sustained_combustion
            </code>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-300 mb-1">Target Investigation</label>
              <select
                value={investigationId}
                onChange={(e) => setInvestigationId(e.target.value)}
                className="w-full px-3 py-2 bg-[#070B14] border border-slate-800 rounded text-slate-200"
              >
                {investigations.map((i) => (
                  <option key={i.investigation_id} value={i.investigation_id}>
                    {i.name} ({i.investigation_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1">NASA PSI / NTRS Source URL</label>
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full px-3 py-2 bg-[#070B14] border border-slate-800 rounded text-slate-200"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="file"
              accept=".csv,.tsv,.json"
              onChange={handleFileChange}
              className="text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-slate-700 file:bg-[#070B14] file:text-sky-300 hover:file:border-sky-500"
            />
            {parsedRecords.length > 0 && (
              <button
                onClick={submitImport}
                disabled={importing}
                className="px-4 py-2 text-xs font-medium bg-sky-500 hover:bg-sky-400 text-slate-950 rounded whitespace-nowrap"
              >
                {importing ? "Ingesting..." : `Ingest ${parsedRecords.length} Records`}
              </button>
            )}
          </div>

          {statusMsg && (
            <div className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-500/40 rounded p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-[#0D1424] border border-slate-800 rounded-md p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">Cloud & Python Pipeline Artifacts</h2>
          <p className="text-slate-400 leading-relaxed">
            For bulk NASA Physical Sciences Informatics Excel, Parquet, or multi-gigabyte telemetry processing in Google
            Colab, use the included Python pipeline modules (located in <code className="text-slate-200">pipeline/</code>):
          </p>
          <ul className="space-y-2 text-slate-300">
            <li>• <code className="text-sky-300">pipeline/flameguard_pipeline.py</code> — Pandas/NumPy/Scikit-Learn ingestion, unit normalization, NULL preservation, and GroupKFold CV</li>
            <li>• <code className="text-sky-300">pipeline/FlameGuard_NASA_PSI_Colab.ipynb</code> — Ready-to-run Google Colab notebook with Drive mount</li>
            <li>• <code className="text-sky-300">db/schema.sql</code> — Normalized SQLite/PostgreSQL schema</li>
          </ul>
          <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-3">
            <a
              href="https://psi.nasa.gov/physci/repo/search?q=combustion&data_source=psi&data_type=investigation"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              Open NASA PSI Repository <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/?tab=resources"
              target="_blank"
              rel="noreferrer"
              className="text-orange-400 hover:underline inline-flex items-center gap-1"
            >
              Space Apps Challenge Resources <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Imported Datasets Registry */}
      <div className="bg-[#0D1424] border border-slate-800 rounded-md p-5">
        <h2 className="text-base font-semibold text-slate-100 mb-3">
          Ingested NASA Data Sources & Processing Status ({documents.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-3">Source Title</th>
                <th className="py-2 px-3">Investigation</th>
                <th className="py-2 px-3">Format</th>
                <th className="py-2 px-3 text-right">Records</th>
                <th className="py-2 px-3">Processing Status</th>
                <th className="py-2 pl-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {documents.map((d) => (
                <tr key={d.document_id} className="hover:bg-slate-800/25">
                  <td className="py-2.5 pr-3 text-slate-100 font-medium">{d.title}</td>
                  <td className="py-2.5 px-3 font-mono text-sky-300 whitespace-nowrap">{d.investigation_name}</td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{d.document_type}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">{d.record_count}</td>
                  <td className="py-2.5 px-3 text-emerald-300">{d.processing_status}</td>
                  <td className="py-2.5 pl-3 whitespace-nowrap">
                    {d.local_path ? (
                      <a href={d.local_path} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                        Local Asset
                      </a>
                    ) : (
                      <a
                        href={d.doi ? `https://doi.org/${d.doi}` : d.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline"
                      >
                        {d.doi ? `DOI ${d.doi}` : "NASA PSI"}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
