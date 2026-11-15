import React, { useState } from "react";
import { BookMarked, ExternalLink, Info, Send } from "lucide-react";

interface Citation {
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

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mode?: "gemini-rag" | "search-fallback";
  model_used?: string;
}

const EXAMPLE_QUESTIONS = [
  "Why did Apollo 1 burn so fast?",
  "What did Mir teach us about fire in orbit?",
  "Why does the fan matter for fire in space?",
  "Why does fire behave differently in microgravity?",
  "What happened in BASS Sample 147 Test B1 when the fan was commanded to zero?",
  "What did FLEX discover about cool flames and droplet extinction?",
];

export const AiResearchAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Open your NASA lab notebook. Ask any question about microgravity combustion—every reply cites the exact NASA PSI, NTRS, or ISS flight record where the evidence comes from.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const lastAssistantWithMode = [...messages].reverse().find((m) => m.role === "assistant" && m.mode);
  const isOfflineMode = lastAssistantWithMode?.mode === "search-fallback";

  const sendQuestion = async (qText?: string) => {
    const question = (qText ?? input).trim();
    if (!question || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    if (!qText) setInput("");
    setLoading(true);

    try {
      const history = nextMessages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to query research assistant");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.answer,
          citations: json.citations,
          mode: json.mode,
          model_used: json.model_used,
        },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Unable to complete query: ${e.message}. Please retry.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-800/90 pb-4">
        <div>
          <div className="font-note text-lg text-amber-300/90">
            Chapter 05 · Citation-Grounded Research Notebook
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            Ask the NASA Research Archive
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-3xl">
            Answers distinguish directly reported NASA observations from general physics and attach clickable source chips.
          </p>
        </div>
      </div>

      {/* Friendly Offline Citation Mode Note */}
      {isOfflineMode && (
        <div className="bg-sky-950/30 border border-sky-500/40 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-sky-100">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-sky-200">Offline Citation Mode active: </span>
            No live Gemini API key is active in this environment, so FlameGuard is retrieving and quoting your answers
            directly from local NASA PSI/NTRS excerpts with source links.
          </div>
        </div>
      )}

      {/* Notebook Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Suggested Question Chips */}
        <div className="xl:col-span-4 bg-[#0D1424] border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
            <BookMarked className="w-4 h-4 text-amber-400" />
            <span>Suggested Questions</span>
          </div>
          <div className="flex flex-wrap xl:flex-col gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendQuestion(q)}
                disabled={loading}
                className="text-left px-3 py-2 text-xs text-slate-200 bg-[#070B14] border border-slate-800 rounded-lg hover:border-amber-400/50 hover:text-amber-200 transition-colors leading-relaxed"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Research Notebook Thread */}
        <div className="xl:col-span-8 bg-[#0D1424] border border-slate-800 rounded-xl flex flex-col h-[560px]">
          <div
            className="flex-1 overflow-y-auto p-5 space-y-5"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(148, 163, 184, 0.045) 31px, rgba(148, 163, 184, 0.045) 32px)",
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div className="text-[11px] font-mono text-slate-400 mb-1">
                  {msg.role === "user" ? "Your question" : `Lab Notebook${msg.model_used ? ` · ${msg.model_used}` : ""}`}
                </div>
                <div
                  className={`max-w-3xl rounded-xl p-4 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-amber-500/15 border border-amber-500/40 text-slate-50"
                      : "bg-[#070B14]/95 border border-slate-800 text-slate-200"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Clickable Citation Chips */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 max-w-3xl w-full space-y-1.5">
                    <div className="font-note text-base text-amber-300/90">
                      Sources cited ({msg.citations.length}) — click to open original NASA record:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.citations.map((c) => (
                        <a
                          key={c.id}
                          href={c.doi ? `https://doi.org/${c.doi}` : c.source_url}
                          target="_blank"
                          rel="noreferrer"
                          title={c.excerpt}
                          className="px-2.5 py-1.5 bg-[#0A101E] border border-slate-700/90 rounded-md hover:border-sky-400/70 text-[11px] inline-flex items-center gap-1.5 text-slate-200 hover:text-sky-200 transition-colors"
                        >
                          <span className="font-mono text-sky-400 font-semibold">[{c.id}]</span>
                          <span className="truncate max-w-[160px]">{c.investigation}</span>
                          {c.is_interpretation ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-[10px]">
                              Interpretation
                            </span>
                          ) : c.source_quality === "secondary" ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-[10px]">
                              Secondary source, verify
                            </span>
                          ) : c.source_quality === "NASA" ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px]">
                              NASA source
                            </span>
                          ) : null}
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="text-xs font-mono text-sky-300">
                Searching NASA PSI corpus and assembling citations...
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion();
            }}
            className="border-t border-slate-800 p-3 flex items-center gap-2.5 bg-[#090E1B] rounded-b-xl"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about BASS-II, FLEX cool flames, SAFFIRE, SPICE, SAME-R, or low-flow quenching..."
              className="flex-1 px-3.5 py-2.5 text-xs bg-[#070B14] border border-slate-800 rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

