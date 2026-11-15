# FlameGuard — NASA Microgravity Fire Intelligence Platform

**NASA Space Apps Challenge 2026: Flame in Freefall**

FlameGuard turns NASA's microgravity combustion archive (**BASS-II**, **FLEX**, **SAFFIRE**, **SPICE**, **SAME-R**, plus cataloged NASA PSI programs) into an interactive, citation-grounded intelligence workspace.

---

## 1. Architecture Overview

- **Primary NASA Artifacts (`/public/assets/aistudio/`)**: 4 ISS BASS-II ProofSheet PDFs, `BASS_GMT50_SAMPLE_147_TEST_B1.mp4` telemetry video, and `flameguard_compact_seed_03ed9310.json`.
- **SQLite Database (`db/schema.sql`)**: Stores `investigations`, `experiments`, `measurements`, `findings`, `documents`, `telemetry_series`, `predictions`, and `datasets_registry`. Missing measurements remain `NULL` (`not in source`).
- **ML Prototype (`server/mlEngine.ts`)**: Physics-informed L2 Logistic Regression + 65-Tree Random Forest trained on complete-feature NASA records (`n = 30`), evaluated with Leave-One-Sample-Group-Out cross-validation, bounded by strict min/max training range checks.
- **Research Assistant (`server/ragEngine.ts`)**: Uses `@google/genai` (`gemini-4-hydrogen`) when `GEMINI_API_KEY` is configured, or switches transparently to **Offline Citation Mode** (local BM25 retrieval over cited NASA sources).

---

## 2. Dataset Inspection & Integrity Rules

1. **Uploaded NASA BASS-II Flight Artifacts:**
   - `GMT2014_050_BASS_S160M_TPB12_ProofSheet_0aea1d2d.pdf` (PMMA Film 160M, Test B12)
   - `BASS_GMT50_SAMPLE_147_TEST_B1_e82f6426.mp4` (Sample 147 Test B1 video with HUD telemetry: crew `"Fan to zero"` at `10:10:06`, flame extinction at `10:10:13`)
   - `GMT2014_100_BASS_S137M_TPT13_ProofSheet_5a777d06.pdf` (SIBAL 137M, Test T13)
   - `GMT2014_188_BASS_S149M_TPB15_ProofSheet_a9b1f9a2.pdf` (Acrylic Flat 149M, Test B15)
   - `GMT2014_216_BASS_S176M_TPB22_ProofSheet_c05b09d8.pdf` (Acrylic Flat 176M, Test B22)
   - **Missing Telemetry Handling:** ProofSheet PDFs verify frame timestamps and visual morphology, but contain **no continuous O2% or calibrated flow velocity (cm/s)**. Those fields stay `NULL` (`not in source`) and are excluded from ML training.

2. **Compact Seed & Dataset Registry (`flameguard_compact_seed_03ed9310.json`):**
   - Catalogs 15 NASA PSI/NTRS datasets in `datasets_registry`, marking newly tracked targets (`SAME`, `FLEX-2`, `CFI`, `ACME-sFlames`, `ACME-BRE`, `ACME-CLD`, `ACME-EField`, `DAFT/DAFT-2`, `SLICE`, `SIBAL`) as `NEW` and `"data not yet imported"` when experiment tables have 0 imported runs.

---

## 3. Limitations

- **Small sample size:** The demonstration classifier trains on `n = 30` NASA benchmark test points across a few representative investigations. Many real spacecraft materials, sample thicknesses, duct geometries, and ignition energies are not represented.
- **ProofSheet PDFs lack O2% and calibrated flow velocity:** Continuous oxygen mole fraction and calibrated flow speed (`cm/s`) are not present in the ProofSheet PDFs, so those measurements are stored as `NULL` (`not in source`) and excluded from ML training rather than fabricated or guessed.
- **Binary outcome only:** The Risk Lab estimates *flame sustained vs. extinction only* — it does **not** predict flame spread rate, fire size, heat release rate, toxic gas yield, or severity.
- **Out-of-range refusal:** Whenever user inputs (`O2%`, `flow velocity`, or `pressure`) fall outside the min/max range of the NASA training records, the model refuses to extrapolate and withholds probability.
- **Not peer reviewed:** Findings syntheses and ML outputs have not undergone independent peer review.
- **Never use for real safety decisions:** FlameGuard is a Space Apps educational and research demonstration prototype — never use it for spacecraft design, crew operations, or NASA-STD-6001 material qualification.

---

## 4. Setup & Running Locally

```bash
npm install
npm run dev
```

- Set `GEMINI_API_KEY` in environment secrets to enable `gemini-4-hydrogen` (`@google/genai`) RAG synthesis (when unset, FlameGuard runs in Offline Citation Mode using BM25).
- Production build: `npm run build && npm start`.

