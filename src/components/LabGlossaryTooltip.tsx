import React, { useState } from "react";
import { HelpCircle } from "lucide-react";

export const GLOSSARY_TERMS: Record<string, { term: string; definition: string }> = {
  quenching: {
    term: "Quenching (low-flow extinction)",
    definition:
      "In microgravity without natural upward convection, if ventilation fan speed drops too low (around 1–3 cm/s), fresh oxygen cannot reach the flame fast enough while heat radiates away—causing the flame to shrink and go out.",
  },
  concurrent_flow: {
    term: "Concurrent flow",
    definition:
      "Airflow moving in the same direction that the flame is spreading. In spacecraft ducts this preheats unburned fuel ahead of the flame front.",
  },
  opposed_flow: {
    term: "Opposed flow",
    definition:
      "Airflow blowing against the direction the flame spreads. Fresh oxygen feeds the leading edge first, which often makes thin fuels burn faster at moderate speeds until very high flow blows the flame out.",
  },
  normoxic: {
    term: "Normoxic atmosphere",
    definition:
      "An atmosphere where oxygen partial pressure matches Earth sea level (~21 kPa O2), such as 30% O2 at 70 kPa pressure—often studied for future Moon/Mars exploration cabins.",
  },
  cool_flame: {
    term: "Cool flame",
    definition:
      "A low-temperature (~500–800 K), nearly invisible chemical reaction observed in ISS droplet tests (FLEX/CFI) that keeps consuming fuel even after the bright hot flame extinguishes.",
  },
  sibal: {
    term: "SIBAL fuel",
    definition:
      "Solid Inflammability Boundary at Low-Speed: a 75% cotton / 25% fiberglass blended fabric standardized by NASA to hold its shape cleanly while burning in microgravity.",
  },
};

interface TooltipProps {
  termKey: keyof typeof GLOSSARY_TERMS;
  label?: string;
}

export const GlossaryTerm: React.FC<TooltipProps> = ({ termKey, label }) => {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY_TERMS[termKey];
  if (!entry) return <span>{label || termKey}</span>;

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center gap-1 border-b border-dotted border-sky-400/70 text-sky-300 hover:text-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded-xs"
        aria-label={`Glossary definition for ${entry.term}`}
      >
        <span>{label || entry.term}</span>
        <HelpCircle className="w-3 h-3 text-sky-400/80 shrink-0" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 p-2.5 rounded-md bg-[#0A1120] border border-slate-700 text-[11px] leading-relaxed text-slate-200 shadow-xl pointer-events-none"
        >
          <span className="block font-semibold text-sky-300 mb-0.5">{entry.term}</span>
          <span>{entry.definition}</span>
        </span>
      )}
    </span>
  );
};
