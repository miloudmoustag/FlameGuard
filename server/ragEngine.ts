import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { FlameGuardDatabase } from "./database.ts";

export interface CitationItem {
  id: string;
  title: string;
  investigation: string;
  source_type: string;
  doi: string | null;
  source_url: string;
  excerpt: string;
  score: number;
  source_quality?: string;
  is_interpretation?: boolean;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RagChatResponse {
  answer: string;
  citations: CitationItem[];
  mode: "gemini-rag" | "search-fallback";
  model_used: string;
}

interface CorpusChunk {
  id: string;
  title: string;
  investigation: string;
  source_type: string;
  doi: string | null;
  source_url: string;
  text: string;
  tokens: string[];
  source_quality?: string;
  is_interpretation?: boolean;
}

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "what", "how", "why",
  "are", "was", "were", "does", "did", "can", "into", "when", "which", "about",
  "have", "has", "had", "under", "between", "aboard", "spacecraft", "nasa",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.\-%]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

function loadLessonsIntoCorpus(chunks: CorpusChunk[]): void {
  try {
    const lessonsPath = path.resolve(process.cwd(), "data", "flameguard_lessons_learned.json");
    if (!fs.existsSync(lessonsPath)) return;
    const raw = fs.readFileSync(lessonsPath, "utf-8");
    const lessons = JSON.parse(raw);

    const incidents = Array.isArray(lessons.incidents) ? lessons.incidents : [];
    for (const inc of incidents) {
      const envParts = Object.entries(inc.environment || {}).map(([k, v]) => `${k}: ${v}`);
      const factSummaries: string[] = [];

      const facts = Array.isArray(inc.facts) ? inc.facts : [];
      facts.forEach((f: any, idx: number) => {
        const qualityLabel = f.source_quality === "NASA" ? "NASA source" : "Secondary source, verify";
        factSummaries.push(`${f.fact} [${qualityLabel}]`);
        const factText = `Incident ${inc.id} (${inc.date}, ${inc.type}) — Fact: ${f.fact} Source quality: ${qualityLabel}. Environment: ${envParts.join(", ")}.`;
        chunks.push({
          id: `${inc.id}-FACT-${idx + 1}`,
          title: `${inc.id} Fact #${idx + 1} (${inc.date})`,
          investigation: `Lessons Learned · ${inc.id}`,
          source_type: `Incident Fact (${qualityLabel})`,
          doi: null,
          source_url: f.source || "",
          text: factText,
          tokens: tokenize(factText),
          source_quality: f.source_quality,
          is_interpretation: false,
        });
      });

      const changes = Array.isArray(inc.changes_made) ? inc.changes_made : [];
      const primarySource = facts[0]?.source || (inc.changes_source && inc.changes_source[0]) || "";
      const incSummary = `Incident ${inc.id} (${inc.date}): ${inc.type}. Environment: ${envParts.join(", ")}. Facts: ${factSummaries.join(" | ")}${
        inc.scope_context ? ` Scope Context: ${inc.scope_context}` : ""
      }${changes.length ? ` Changes made after incident: ${changes.join(" | ")}` : ""}`;

      chunks.push({
        id: inc.id,
        title: `${inc.id} (${inc.date}): ${inc.type}`,
        investigation: `Lessons Learned · ${inc.id}`,
        source_type: "Spacecraft Fire Incident Summary",
        doi: null,
        source_url: primarySource,
        text: incSummary,
        tokens: tokenize(incSummary),
        source_quality: facts.some((f: any) => f.source_quality === "NASA") ? "NASA" : "secondary",
        is_interpretation: false,
      });
    }

    const hwList = Array.isArray(lessons.iss_fire_safety_hardware) ? lessons.iss_fire_safety_hardware : [];
    hwList.forEach((hw: any, idx: number) => {
      const text = `ISS fire safety hardware: ${hw.item}`;
      chunks.push({
        id: `ISS-HARDWARE-${idx + 1}`,
        title: `ISS Fire Safety Hardware #${idx + 1}`,
        investigation: "Lessons Learned · ISS Hardware",
        source_type: "ISS Fire Safety Hardware",
        doi: null,
        source_url: hw.source || "",
        text,
        tokens: tokenize(text),
        source_quality: hw.source?.includes("nasa.gov") ? "NASA" : "secondary",
        is_interpretation: false,
      });
    });

    const sciLinks = Array.isArray(lessons.microgravity_fire_science_links)
      ? lessons.microgravity_fire_science_links
      : [];
    sciLinks.forEach((sl: any, idx: number) => {
      const text = `Microgravity fire science link: ${sl.link}`;
      chunks.push({
        id: `FIRE-SCIENCE-LINK-${idx + 1}`,
        title: `Microgravity Fire Science Link #${idx + 1}`,
        investigation: "Lessons Learned · Fire Science",
        source_type: "Microgravity Science Link",
        doi: null,
        source_url: sl.source || "",
        text,
        tokens: tokenize(text),
        source_quality: sl.source?.includes("nasa.gov") ? "NASA" : "secondary",
        is_interpretation: false,
      });
    });

    const takeaways = lessons.design_takeaways;
    if (takeaways && Array.isArray(takeaways.items)) {
      const interpLabel = takeaways.label || "OUR interpretation of the sources above. Not official NASA procedure.";
      for (const t of takeaways.items) {
        const evidenceStr = Array.isArray(t.evidence) ? t.evidence.join(", ") : "";
        const text = `Design Takeaway ${t.id} [OUR INTERPRETATION — NOT OFFICIAL NASA PROCEDURE]: ${t.takeaway} Evidence cited: ${evidenceStr}. Disclaimer: ${interpLabel}`;
        chunks.push({
          id: `TAKEAWAY-${t.id}`,
          title: `Design Takeaway ${t.id} (Our Interpretation)`,
          investigation: "Lessons Learned · Interpretation",
          source_type: "Our Interpretation (Not Official NASA Procedure)",
          doi: null,
          source_url: "https://ntrs.nasa.gov",
          text,
          tokens: tokenize(text),
          is_interpretation: true,
        });
      }
    }
  } catch (err) {
    console.error("Failed to index flameguard_lessons_learned.json into RAG corpus:", err);
  }
}

function buildCorpus(dbManager: FlameGuardDatabase): CorpusChunk[] {
  const chunks: CorpusChunk[] = [];
  const invs = dbManager.getInvestigationsDetail();
  const findings = dbManager.getFindings() as any[];
  const docs = dbManager.getDocuments() as any[];

  for (const inv of invs) {
    const text = `${inv.name} ${inv.full_title}. ${inv.description} Principal investigators: ${inv.principal_investigators}. Platform: ${inv.platform}. Research area: ${inv.research_area}.`;
    chunks.push({
      id: inv.investigation_id,
      title: `${inv.name}: ${inv.full_title}`,
      investigation: inv.name,
      source_type: "NASA Investigation",
      doi: inv.doi,
      source_url: inv.nasa_source,
      text,
      tokens: tokenize(text),
      source_quality: "NASA",
    });

    for (const exp of inv.experiments) {
      const measSummary = exp.measurements
        .map((m: any) =>
          m.normalized_value !== null
            ? `${m.parameter_name}=${m.normalized_value} ${m.normalized_unit}`
            : `${m.parameter_name}=MISSING_IN_SOURCE`
        )
        .join(", ");
      const expText = `Experiment ${exp.experiment_id} (${inv.name}), Material: ${exp.material} (${exp.fuel_type}), Gravity: ${exp.gravity_condition}, Outcome: ${exp.outcome_label}. ${exp.experiment_description} Measurements: ${measSummary}. Quality note: ${exp.data_quality_note}`;
      chunks.push({
        id: exp.experiment_id,
        title: `${exp.experiment_id} (${exp.material})`,
        investigation: inv.name,
        source_type: exp.provenance_type,
        doi: exp.doi,
        source_url: exp.source_url,
        text: expText,
        tokens: tokenize(expText),
        source_quality: "NASA",
      });
    }
  }

  for (const f of findings) {
    const text = `Finding ${f.finding_id} (${f.investigation_name}): ${f.title}. Researchers: ${f.researchers}. Objective: ${f.scientific_objective} Conditions: ${f.experimental_conditions} Observed results: ${f.observation} Key measurements: ${f.important_measurements} Researcher conclusions: ${f.researcher_conclusion} Safety implications: ${f.safety_implication} Limitations: ${f.limitations}`;
    chunks.push({
      id: f.finding_id,
      title: f.title,
      investigation: f.investigation_name,
      source_type: "Extracted Research Finding",
      doi: f.doi,
      source_url: f.source_url,
      text,
      tokens: tokenize(text),
      source_quality: "NASA",
    });
  }

  for (const d of docs) {
    const text = `Document ${d.document_id} (${d.investigation_name}, ${d.document_type}): ${d.title}. ${d.extracted_text}`;
    chunks.push({
      id: d.document_id,
      title: d.title,
      investigation: d.investigation_name,
      source_type: d.document_type,
      doi: d.doi,
      source_url: d.source_url,
      text,
      tokens: tokenize(text),
      source_quality: "NASA",
    });
  }

  loadLessonsIntoCorpus(chunks);

  return chunks;
}

function retrieveChunks(query: string, corpus: CorpusChunk[], topK = 6): CitationItem[] {
  const qTokens = tokenize(query);
  const qLower = query.toLowerCase();

  const df = new Map<string, number>();
  for (const c of corpus) {
    const uniq = new Set(c.tokens);
    for (const t of uniq) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = corpus.length;

  const scored = corpus.map((chunk) => {
    const tf = new Map<string, number>();
    for (const t of chunk.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const qt of qTokens) {
      const freq = tf.get(qt) ?? 0;
      if (freq > 0) {
        const idf = Math.log(1 + (N - (df.get(qt) ?? 0) + 0.5) / ((df.get(qt) ?? 0) + 0.5));
        score += ((freq * 1.6) / (freq + 0.6 * (0.3 + (0.7 * chunk.tokens.length) / 50))) * idf;
      }
    }

    const entities = [
      "bass-ii",
      "bass",
      "flex",
      "saffire",
      "spice",
      "same-r",
      "same",
      "cool flame",
      "oxygen",
      "airflow",
      "fan",
      "extinction",
      "smoke",
      "pmma",
      "sibal",
      "147",
      "160m",
      "137m",
      "149m",
      "176m",
      "apollo 13",
      "apollo-13",
      "mir",
      "vika",
      "sfog",
      "hatch",
      "soyuz",
      "water mist",
      "teach",
      "lesson",
    ];
    const chunkLower = chunk.text.toLowerCase();
    for (const ent of entities) {
      if (qLower.includes(ent) && chunkLower.includes(ent)) {
        score += 1.9;
      }
    }
    // Boundary-safe Apollo 1 match so "Apollo 1" never boosts "Apollo 13"
    if (/\bapollo[- ]1\b/.test(qLower) && /\bapollo[- ]1\b/.test(chunkLower)) {
      score += 3.2;
    }
    if (chunk.source_type === "Extracted Research Finding") score *= 1.3;
    if (chunk.source_type === "NASA Investigation") score *= 1.15;
    if (chunk.source_type === "Spacecraft Fire Incident Summary") score *= 1.25;
    if (chunk.source_type.startsWith("Incident Fact")) score *= 1.25;
    if (chunk.is_interpretation && (qLower.includes("teach") || qLower.includes("lesson") || qLower.includes("fan") || qLower.includes("fast"))) {
      score *= 1.35;
    }

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const maxScore = scored[0]?.score || 1;

  return scored
    .slice(0, topK)
    .filter((s) => s.score > 0.1)
    .map((s) => ({
      id: s.chunk.id,
      title: s.chunk.title,
      investigation: s.chunk.investigation,
      source_type: s.chunk.source_type,
      doi: s.chunk.doi,
      source_url: s.chunk.source_url,
      excerpt: s.chunk.text.slice(0, 340) + (s.chunk.text.length > 340 ? "..." : ""),
      score: Number((s.score / Math.max(0.01, maxScore)).toFixed(2)),
      source_quality: s.chunk.source_quality,
      is_interpretation: s.chunk.is_interpretation,
    }));
}

function buildSearchFallbackAnswer(query: string, citations: CitationItem[]): string {
  if (citations.length === 0) {
    return [
      "### Offline Citation Mode — No Exact Match in Imported Corpus",
      `No matching records were found in the currently imported FlameGuard database or lessons archive for: "${query}".`,
      "",
      "**What is needed:** Import additional NASA Physical Sciences Informatics (PSI) datasets via the Library CSV importer, or ask about Apollo 1, Apollo 13, Mir (1997), BASS-II, FLEX, SAFFIRE, SPICE, SAME-R, oxygen limits, or fan airflow.",
    ].join("\n");
  }

  const hasInterpretation = citations.some((c) => c.is_interpretation);
  const hasSecondary = citations.some((c) => c.source_quality === "secondary");

  const lines: string[] = [
    "### Offline Citation Mode (Local NASA & Lessons Corpus Retriever)",
    `Matched ${citations.length} records from the local FlameGuard archive.`,
    "",
  ];

  if (hasInterpretation) {
    lines.push(
      "> **Interpretation Notice:** One or more matched items below are from `design_takeaways` — **OUR interpretation of the cited sources, NOT official NASA procedure.** Do not treat them as step-by-step emergency instructions."
    );
    lines.push("");
  }

  lines.push("**Reported Records & Excerpts:**");
  citations.slice(0, 5).forEach((c) => {
    const qualityTag = c.is_interpretation
      ? "Our interpretation — not official NASA procedure"
      : c.source_quality === "secondary"
      ? "Secondary source, verify"
      : c.source_quality === "NASA"
      ? "NASA source"
      : c.source_type;
    lines.push(
      `- **[${c.id}] ${c.title}** (${qualityTag}${c.doi ? `, DOI: ${c.doi}` : ""}): ${c.excerpt}`
    );
  });

  lines.push("");
  lines.push("**Evidence & Honesty Boundary:**");
  lines.push(
    "- All experimental parameters and historical incident facts come strictly from the cited records."
  );
  if (hasSecondary) {
    lines.push(
      "- Citations marked `Secondary source, verify` come from non-NASA pages and should be double-checked before putting them in a final report."
    );
  }
  lines.push(
    "- Educational research content only — not official NASA procedure or operational fire-response instructions."
  );

  return lines.join("\n");
}

export async function answerResearchQuestion(
  dbManager: FlameGuardDatabase,
  question: string,
  history: ChatTurn[] = []
): Promise<RagChatResponse> {
  const corpus = buildCorpus(dbManager);
  const citations = retrieveChunks(question, corpus, 6);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      answer: buildSearchFallbackAnswer(question, citations),
      citations,
      mode: "search-fallback",
      model_used: "Offline Citation Mode (BM25 Local Corpus Retriever)",
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const contextBlock = citations
      .map((c) => {
        const qBadge = c.is_interpretation
          ? "INTERPRETATION (NOT OFFICIAL NASA PROCEDURE)"
          : c.source_quality === "secondary"
          ? "Secondary source, verify"
          : "NASA source";
        return `[${c.id}] (${c.investigation} | ${qBadge}${c.doi ? ` | DOI: ${c.doi}` : ""} | URL: ${c.source_url})\n${c.excerpt}`;
      })
      .join("\n\n");

    const historyBlock = history
      .slice(-6)
      .map((h) => `${h.role === "user" ? "Researcher" : "FlameGuard"}: ${h.content}`)
      .join("\n");

    const prompt = `
CONVERSATION HISTORY:
${historyBlock || "(No prior turns)"}

RETRIEVED CORPUS SOURCES:
${contextBlock || "(No strongly matching documents in imported database)"}

USER QUESTION:
${question}
`;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        systemInstruction: `You are FlameGuard AI, a specialized aerospace combustion research analyst grounded in NASA's microgravity fire archive (BASS-II, FLEX, SAFFIRE, SPICE, SAME-R) and historical spacecraft fire lessons learned (Apollo 1, Apollo 13, Mir 1997).

MANDATORY SCIENTIFIC INTEGRITY & SAFETY RULES:
1. Cite every claim inline using the exact bracketed ID from RETRIEVED CORPUS SOURCES (e.g., [APOLLO-1-FACT-2], [MIR-1997], [TAKEAWAY-T4], [BASS2-GMT050-S147-B1]).
2. Respect source_quality: when citing a record labeled "Secondary source, verify", note clearly that it is a secondary source to verify.
3. INTERPRETATION RULE: Any record from design_takeaways (e.g., [TAKEAWAY-T1]..[TAKEAWAY-T7]) is OUR interpretation of historical and NASA research sources — NOT official NASA procedure. Whenever you cite or summarize design_takeaways, explicitly state: "This is our interpretation of the sources, not official NASA procedure." NEVER present takeaways as official NASA procedure and NEVER give step-by-step emergency fire-response instructions.
4. Be respectful, factual, and brief when discussing Apollo 1; never use dramatic or gory language.
5. NEVER invent facts, numbers, quotes, DOIs, or sources not in RETRIEVED CORPUS SOURCES.`,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return {
        answer: buildSearchFallbackAnswer(question, citations),
        citations,
        mode: "search-fallback",
        model_used: "Offline Citation Mode (Empty Model Output)",
      };
    }

    return {
      answer: text,
      citations,
      mode: "gemini-rag",
      model_used: "gemini-4-hydrogen (@google/genai) + NASA & Lessons RAG",
    };
  } catch (err) {
    console.error("Gemini RAG error, falling back to local retrieval:", err);
    return {
      answer: buildSearchFallbackAnswer(question, citations),
      citations,
      mode: "search-fallback",
      model_used: "Offline Citation Mode (API Unavailable)",
    };
  }
}
