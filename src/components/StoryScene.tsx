import React, { useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Play, Pause, RotateCcw } from "lucide-react";
import { PageId, TelemetryPoint } from "../types";
import { GlossaryTerm } from "./LabGlossaryTooltip";

interface Props {
  telemetry: TelemetryPoint[];
  onNavigate: (page: PageId) => void;
}

interface StoryStep {
  step: number;
  timeSec: number;
  utc: string;
  title: string;
  summary: string;
  telemetryCue: string;
}

const STORY_STEPS: StoryStep[] = [
  {
    step: 1,
    timeSec: 0,
    utc: "10:09:36 UTC",
    title: "1. Ignition in forced cabin flow",
    summary:
      "Inside the ISS Microgravity Science Glovebox, Sample 147 Test B1 is ignited while the duct fan supplies steady low-speed airflow.",
    telemetryCue: "FAN ~2.2 V · RAD rising as flame establishes",
  },
  {
    step: 2,
    timeSec: 20,
    utc: "10:09:56 UTC",
    title: "2. Flame holds steady only because of the fan",
    summary:
      "On Earth, hot smoke rises and pulls fresh oxygen in automatically. In 0g, this flame depends entirely on the ventilation fan to bring oxygen to the fuel.",
    telemetryCue: "FAN ~2.2 V · RAD near steady peak (~0.84)",
  },
  {
    step: 3,
    timeSec: 30,
    utc: "10:10:06 UTC",
    title: '3. Crew calls "Fan to zero"',
    summary:
      'At 10:10:06 UTC (t = 30s), the operator commands the fan voltage to zero. Forced convective oxygen delivery halts immediately.',
    telemetryCue: 'FAN drops 2.2 V → 0.0 V ("Fan off")',
  },
  {
    step: 4,
    timeSec: 34,
    utc: "10:10:10 UTC",
    title: "4. Flame shrinks & cools",
    summary:
      "Without fresh airflow, combustion products linger around the fuel and heat radiates away faster than oxygen can diffuse in.",
    telemetryCue: "RAD falls rapidly (~0.8 → 0.2)",
  },
  {
    step: 5,
    timeSec: 37,
    utc: "10:10:13 UTC",
    title: "5. Extinction in 7 seconds",
    summary:
      "At 10:10:13 UTC (t = 37s), radiometer output reaches baseline—demonstrating how turning off ventilation can quench microgravity flames.",
    telemetryCue: "RAD = 0.06 baseline (Extinction)",
  },
];

export const StoryScene: React.FC<Props> = ({ telemetry, onNavigate }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeStepIdx, setActiveStepIdx] = useState(2); // Start highlighted on the pivotal "Fan to zero" beat or let user step through 1..5
  const [currentSec, setCurrentSec] = useState<number>(30);
  const [isPlaying, setIsPlaying] = useState(false);

  const visibleTelemetry = useMemo(() => {
    if (!telemetry || telemetry.length === 0) return [];
    const filtered = telemetry.filter((pt) => pt.elapsed_sec <= currentSec);
    return filtered.length > 0 ? filtered : telemetry.slice(0, 1);
  }, [telemetry, currentSec]);

  const jumpToStep = (idx: number) => {
    const clamped = Math.max(0, Math.min(STORY_STEPS.length - 1, idx));
    const targetSec = STORY_STEPS[clamped].timeSec;
    setActiveStepIdx(clamped);
    setCurrentSec(targetSec);
    if (videoRef.current) {
      try {
        videoRef.current.currentTime = targetSec;
      } catch {
        // Ignore seek errors before metadata loads
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentSec(t);
    // Sync step indicator with current video timestamp
    let matched = 0;
    for (let i = 0; i < STORY_STEPS.length; i++) {
      if (t >= STORY_STEPS[i].timeSec - 0.5) matched = i;
    }
    setActiveStepIdx(matched);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const activeStep = STORY_STEPS[activeStepIdx];
  const latestPoint = visibleTelemetry[visibleTelemetry.length - 1];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-800/90 pb-4">
        <div>
          <div className="font-note text-lg text-amber-300/90">
            Chapter 01 · ISS Flight Event Walkthrough
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
            BASS Sample 147 Test B1: Turning Off the Fan
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-3xl">
            Walk through the real ISS video and telemetry from the moment the crew shuts down airflow to observe low-flow{" "}
            <GlossaryTerm termKey="quenching" label="quenching" />.
          </p>
        </div>

        <a
          href="https://psi.nasa.gov/physci/repo/search?q=BASS-II&data_source=psi&data_type=investigation"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 text-xs bg-[#0D1424] border border-slate-700 rounded text-slate-200 hover:border-sky-500/50 inline-flex items-center gap-1.5 w-fit shrink-0"
        >
          <span>Source: BASS_GMT50_SAMPLE_147_TEST_B1.mp4</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* 5-Step Guided Stepper */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2" role="tablist" aria-label="BASS Sample 147 Event Steps">
        {STORY_STEPS.map((s, idx) => {
          const isCurrent = idx === activeStepIdx;
          const isPast = currentSec >= s.timeSec;
          return (
            <button
              key={s.step}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => jumpToStep(idx)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                isCurrent
                  ? "bg-amber-500/12 border-amber-400/70 text-slate-50"
                  : isPast
                  ? "bg-[#0D1424] border-slate-700 text-slate-300 hover:border-slate-500"
                  : "bg-[#0A101E] border-slate-800/80 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={isCurrent ? "text-amber-300 font-semibold" : "text-slate-400"}>
                  t = {s.timeSec}s
                </span>
                <span className="text-slate-500">{s.utc.replace(" UTC", "")}</span>
              </div>
              <div className="text-xs font-semibold mt-1 line-clamp-2">{s.title}</div>
            </button>
          );
        })}
      </div>

      {/* Split Workspace: ISS Flight Video + Progressive Telemetry Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: ISS Flight Video + Step Narrative */}
        <div className="lg:col-span-5 bg-[#0D1424] border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="relative rounded-lg overflow-hidden bg-black border border-slate-800">
            <video
              ref={videoRef}
              src="/assets/aistudio/BASS_GMT50_SAMPLE_147_TEST_B1_e82f6426.mp4"
              controls
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full max-h-[270px] object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="px-3 py-1.5 rounded bg-sky-500/15 border border-sky-500/40 text-sky-200 hover:bg-sky-500/25 inline-flex items-center gap-1.5 font-medium"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? "Pause Video" : "Play Video"}</span>
              </button>
              <button
                type="button"
                onClick={() => jumpToStep(0)}
                className="px-2.5 py-1.5 rounded bg-[#070B14] border border-slate-800 text-slate-300 hover:text-white inline-flex items-center gap-1"
                title="Reset to t=0s"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>t=0s</span>
              </button>
            </div>
            <span className="font-mono text-slate-400 tabular-nums">
              t = {currentSec.toFixed(1)}s / 40.0s
            </span>
          </div>

          {/* Active Step Explanation Card */}
          <div className="bg-[#070B14] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-amber-300 font-semibold">{activeStep.utc}</span>
              <span className="text-slate-400">Step {activeStep.step} of 5</span>
            </div>
            <h2 className="text-sm font-semibold text-slate-100">{activeStep.title}</h2>
            <p className="text-xs text-slate-300 leading-relaxed">{activeStep.summary}</p>
            <div className="text-[11px] font-mono text-sky-300 pt-1">{activeStep.telemetryCue}</div>
          </div>

          {/* Step Prev / Next */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              disabled={activeStepIdx === 0}
              onClick={() => jumpToStep(activeStepIdx - 1)}
              className="px-3 py-1.5 text-xs rounded border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            {activeStepIdx < STORY_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => jumpToStep(activeStepIdx + 1)}
                className="px-3.5 py-1.5 text-xs rounded bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 inline-flex items-center gap-1"
              >
                <span>Next step</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate("explore")}
                className="px-3.5 py-1.5 text-xs rounded bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400 inline-flex items-center gap-1.5"
              >
                <span>Explore Flammability Map</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Progressive Telemetry Chart with Handwritten Margin Notes */}
        <div className="lg:col-span-7 bg-[#0D1424] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                HUD Telemetry Trace: Fan Voltage &amp; Radiometer Decay
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Drawn up to current playback timestamp ({currentSec.toFixed(1)}s) from real HUD readings
              </p>
            </div>
            {latestPoint && (
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <span className="text-sky-300">FAN: {latestPoint.fan_telemetry.toFixed(2)} V</span>
                <span className="text-orange-300">RAD: {latestPoint.radiometer_value.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Handwritten margin note callouts */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-base font-note text-amber-300/90 pl-2">
            <span className={currentSec >= 30 ? "opacity-100" : "opacity-35"}>
              ✎ 30s: &ldquo;Fan off&rdquo; (10:10:06)
            </span>
            <span className={currentSec >= 34 ? "opacity-100" : "opacity-35"}>
              ✎ 34s: &ldquo;Flame shrinks&rdquo;
            </span>
            <span className={currentSec >= 37 ? "opacity-100" : "opacity-35"}>
              ✎ 37s: &ldquo;Extinction&rdquo; (10:10:13)
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visibleTelemetry} margin={{ top: 18, right: 20, left: -8, bottom: 8 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="elapsed_sec"
                  domain={[0, 40]}
                  ticks={[0, 10, 20, 30, 34, 37, 40]}
                  unit="s"
                  stroke="#94A3B8"
                  fontSize={11}
                />
                <YAxis stroke="#94A3B8" domain={[0, 2.5]} fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#070B14", borderColor: "#334155", fontSize: "12px" }}
                  formatter={(val: any, name: any) => [
                    Number(val).toFixed(2),
                    name === "fan_telemetry" ? "Fan Voltage (HUD)" : "Radiometer Intensity",
                  ]}
                  labelFormatter={(sec) => `Elapsed t = ${sec}s`}
                />
                <ReferenceLine
                  x={30}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  label={{ value: "Fan off", position: "top", fill: "#FCD34D", fontSize: 11 }}
                />
                {currentSec >= 33 && (
                  <ReferenceLine
                    x={34}
                    stroke="#FB923C"
                    strokeDasharray="3 3"
                    label={{ value: "Flame shrinks", position: "insideTopRight", fill: "#FDBA74", fontSize: 10 }}
                  />
                )}
                {currentSec >= 37 && (
                  <ReferenceLine
                    x={37}
                    stroke="#38BDF8"
                    strokeDasharray="4 4"
                    label={{ value: "Extinction", position: "top", fill: "#7DD3FC", fontSize: 11 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="fan_telemetry"
                  name="fan_telemetry"
                  stroke="#38BDF8"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="radiometer_value"
                  name="radiometer_value"
                  stroke="#F97316"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Note on missing uncalibrated telemetry */}
          <div className="bg-[#070B14] border border-slate-800/80 rounded-lg p-3.5 text-xs space-y-1.5">
            <div className="text-slate-100 font-semibold">Why does this matter?</div>
            <p className="text-slate-300 leading-relaxed">
              On spacecraft, shutting down cabin HVAC ventilation immediately stops forced oxygen delivery—quenching most
              smoldering or spreading fires within seconds. Note that HUD fan volts are uncalibrated telemetry: continuous
              O2% and calibrated cm/s airspeed are marked <span className="font-mono text-amber-300">not in source</span>{" "}
              for this flight clip.
            </p>
            <p className="text-[11px] text-slate-400">
              Chart summary: Fan voltage stays near 2.2 V from 0–28s while radiometer intensity holds around 0.80–0.86;
              fan drops to 0.00 V at 30s and radiometer decays to baseline 0.06 by 37s.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
