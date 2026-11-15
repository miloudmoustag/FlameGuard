import React, { useState } from "react";
import { ArrowRight, Flame, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface HeroSceneProps {
  onStartInvestigation: () => void;
  stats?: {
    experiments: number;
    investigations: number;
    findings: number;
  };
}

export const HeroScene: React.FC<HeroSceneProps> = ({ onStartInvestigation, stats }) => {
  const [gravity, setGravity] = useState<"1g" | "0g">("0g");
  const prefersReducedMotion = useReducedMotion();

  const isZeroG = gravity === "0g";

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col justify-between px-4 sm:px-8 py-6 relative overflow-hidden">
      {/* Subtle coordinate grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 65% 42%, rgba(56, 189, 248, 0.14), transparent 46%), radial-gradient(circle at 35% 58%, rgba(245, 158, 11, 0.11), transparent 44%), linear-gradient(to right, rgba(148, 163, 184, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.06) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 100% 100%, 48px 48px, 48px 48px",
        }}
      />

      {/* Minimal Top Brand Bar */}
      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Flame className="w-5 h-5 text-amber-400" />
          <span className="font-display text-lg font-bold tracking-tight text-slate-50">
            FlameGuard
          </span>
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">
            · NASA Space Apps 2026
          </span>
        </div>
        <div className="text-xs font-mono text-slate-400">
          {stats ? `${stats.experiments} NASA test records · ${stats.findings} findings` : "Flame in Freefall"}
        </div>
      </header>

      {/* Main Split Hero: Human Story Copy + Interactive 1g/0g Flame */}
      <main className="relative z-10 max-w-6xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        {/* Left: Copy + CTA */}
        <div className="lg:col-span-7 space-y-6">
          <div className="font-note text-xl sm:text-2xl text-amber-300/90 -rotate-1 inline-block">
            Lab Notebook · Orbital Combustion Physics
          </div>

          <h1 className="font-display text-3xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-slate-50 leading-[1.08]">
            On Earth fire rises. In orbit it doesn&apos;t.{" "}
            <span className="text-amber-400">Here is why that matters for astronauts.</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
            Without gravity pulling cool air down and lifting hot exhaust up, a spacecraft flame turns into a quiet,
            round sphere. Turning off a cabin ventilation fan can starve a fire—or leave an invisible{" "}
            <span className="text-sky-300 font-medium">cool flame</span> burning silently.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onStartInvestigation}
              className="px-6 py-3.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm inline-flex items-center gap-2.5 transition-colors shadow-lg shadow-amber-500/15 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <span>Start the investigation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400">
              Grounded in real ISS BASS-II, FLEX, SAFFIRE &amp; PSI data
            </span>
          </div>
        </div>

        {/* Right: Interactive Gravity Flame Apparatus */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-md bg-[#0D1424]/95 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
            {/* Gravity Switch */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-400">GRAVITY REGIME</span>
              <div
                className="inline-flex rounded-md bg-[#070B14] border border-slate-800 p-1"
                role="group"
                aria-label="Toggle gravity condition"
              >
                <button
                  type="button"
                  onClick={() => setGravity("1g")}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                    gravity === "1g"
                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  1g Earth
                </button>
                <button
                  type="button"
                  onClick={() => setGravity("0g")}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                    gravity === "0g"
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  0g Microgravity
                </button>
              </div>
            </div>

            {/* Animated Flame Chamber SVG */}
            <div className="relative bg-[#060911] border border-slate-800/90 rounded-lg h-64 flex items-center justify-center overflow-hidden">
              <svg
                viewBox="0 0 280 230"
                className="w-full h-full"
                role="img"
                aria-label={
                  isZeroG
                    ? "Microgravity flame visualization: symmetrical blue-tinted spherical diffusion flame without upward buoyancy plume"
                    : "Earth 1g flame visualization: elongated orange-amber teardrop flame rising due to buoyant convection"
                }
              >
                <defs>
                  <radialGradient id="zeroGGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.95" />
                    <stop offset="40%" stopColor="#38BDF8" stopOpacity="0.72" />
                    <stop offset="78%" stopColor="#0284C7" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="oneGGlow" cx="50%" cy="62%" r="55%">
                    <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.95" />
                    <stop offset="45%" stopColor="#F59E0B" stopOpacity="0.78" />
                    <stop offset="82%" stopColor="#EA580C" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Chamber reticle */}
                <line x1="20" y1="185" x2="260" y2="185" stroke="#1E293B" strokeDasharray="3 4" />
                <line x1="140" y1="20" x2="140" y2="205" stroke="#1E293B" strokeDasharray="3 4" />

                {/* Sample holder / wick */}
                <rect x="136" y="142" width="8" height="44" rx="2" fill="#475569" />
                <rect x="122" y="184" width="36" height="8" rx="2" fill="#334155" />

                {/* Convection arrows only in 1g */}
                <motion.g
                  initial={false}
                  animate={{ opacity: isZeroG ? 0 : 0.7 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
                >
                  <path d="M 88 158 Q 100 128 112 108" fill="none" stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="3 3" />
                  <path d="M 192 158 Q 180 128 168 108" fill="none" stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="3 3" />
                  <text x="34" y="168" fill="#94A3B8" fontSize="9" fontFamily="monospace">cool air in</text>
                  <text x="196" y="168" fill="#94A3B8" fontSize="9" fontFamily="monospace">cool air in</text>
                  <text x="148" y="34" fill="#FDBA74" fontSize="9" fontFamily="monospace">hot plume rises ↑</text>
                </motion.g>

                {/* Diffusion ring note in 0g */}
                <motion.g
                  initial={false}
                  animate={{ opacity: isZeroG ? 0.85 : 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
                >
                  <circle cx="140" cy="118" r="56" fill="none" stroke="#38BDF8" strokeWidth="1" strokeDasharray="4 4" opacity="0.45" />
                  <text x="28" y="42" fill="#7DD3FC" fontSize="9" fontFamily="monospace">O2 arrives by slow diffusion</text>
                </motion.g>

                {/* Outer aura */}
                <motion.circle
                  cx="140"
                  cy={isZeroG ? 118 : 106}
                  r={isZeroG ? 54 : 62}
                  fill={isZeroG ? "url(#zeroGGlow)" : "url(#oneGGlow)"}
                  animate={
                    prefersReducedMotion
                      ? { scale: 1 }
                      : { scale: isZeroG ? [0.97, 1.03, 0.97] : [0.96, 1.05, 0.98] }
                  }
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Morphing Flame Shape: Teardrop (1g) <-> Sphere (0g) */}
                <motion.path
                  fill={isZeroG ? "#38BDF8" : "#F97316"}
                  fillOpacity={isZeroG ? 0.55 : 0.82}
                  stroke={isZeroG ? "#7DD3FC" : "#FDBA74"}
                  strokeWidth="1.5"
                  initial={false}
                  animate={{
                    d: isZeroG
                      ? "M 140 82 C 164 82, 176 100, 176 118 C 176 138, 160 152, 140 152 C 120 152, 104 138, 104 118 C 104 100, 116 82, 140 82 Z"
                      : "M 140 36 C 150 68, 170 96, 168 124 C 166 144, 154 152, 140 152 C 126 152, 114 144, 112 124 C 110 96, 130 68, 140 36 Z",
                    scaleY: prefersReducedMotion ? 1 : isZeroG ? [1, 1.02, 1] : [1, 1.06, 0.97, 1],
                  }}
                  style={{ transformOrigin: "140px 145px" }}
                  transition={{
                    d: { duration: prefersReducedMotion ? 0 : 0.65, ease: "easeInOut" },
                    scaleY: { duration: 1.9, repeat: Infinity, ease: "easeInOut" },
                  }}
                />

                {/* Inner core */}
                <motion.path
                  fill={isZeroG ? "#E0F2FE" : "#FEF08A"}
                  fillOpacity={0.9}
                  initial={false}
                  animate={{
                    d: isZeroG
                      ? "M 140 100 C 151 100, 158 108, 158 118 C 158 128, 150 135, 140 135 C 130 135, 122 128, 122 118 C 122 108, 129 100, 140 100 Z"
                      : "M 140 72 C 146 94, 155 110, 153 128 C 152 138, 146 142, 140 142 C 134 142, 128 138, 127 128 C 125 110, 134 94, 140 72 Z",
                  }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.65, ease: "easeInOut" }}
                />
              </svg>

              {/* Handwritten margin annotation inside chamber */}
              <div className="absolute bottom-2.5 left-3 font-note text-base text-slate-300/90">
                {isZeroG ? "spherical diffusion flame (0g)" : "buoyant teardrop plume (1g)"}
              </div>
              {prefersReducedMotion && (
                <div className="absolute top-2.5 right-3 text-[10px] font-mono text-slate-500">
                  reduced-motion active
                </div>
              )}
            </div>

            {/* Plain-language physical explanation */}
            <div className="text-xs leading-relaxed text-slate-300 bg-[#070B14] border border-slate-800/80 rounded-md p-3.5">
              {isZeroG ? (
                <>
                  <div className="flex items-center gap-1.5 text-sky-300 font-semibold mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>In 0g, flames become calm spheres—and harder to spot</span>
                  </div>
                  Hot combustion gases stay put around the fuel. Fresh oxygen only reaches the reaction zone by slow
                  diffusion or spacecraft cabin ventilation, lowering flame temperature and creating blue, nearly soot-free
                  spheres.
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-orange-300 font-semibold mb-1">
                    <Flame className="w-3.5 h-3.5" />
                    <span>In 1g, hot gas rises and pulls fresh oxygen in</span>
                  </div>
                  Gravity creates buoyancy: hot exhaust shoots upward while cool dense air rushes into the base of the
                  flame, stretching it into a bright yellow-orange teardrop.
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Subtle footer note */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 border-t border-slate-800/60 pt-4">
        <span>Research demonstration prototype · Never for operational spacecraft decisions</span>
        <span className="font-mono">SQLite + NASA PSI + @google/genai</span>
      </footer>
    </div>
  );
};
