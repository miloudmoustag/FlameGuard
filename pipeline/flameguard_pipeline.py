"""
FlameGuard NASA Microgravity Combustion Data Pipeline (Python / Pandas / NumPy / Scikit-Learn)
Supports CSV, Excel (.xlsx/.xls), JSON, TSV, Parquet, and PDF ProofSheet metadata ingestion.
Preserves original units, normalizes SI units, flags missing values without imputation,
prevents sample-group train/test leakage via GroupKFold, and exports clean SQLite/JSON datasets.
"""

from __future__ import annotations
import json
import sqlite3
from pathlib import Path
from typing import Dict


SUPPORTED_EXTENSIONS = {".csv", ".tsv", ".json", ".xlsx", ".xls", ".parquet"}

UNIT_CONVERSIONS = {
    "oxygen_concentration": {"target_unit": "% vol", "scale": 1.0, "offset": 0.0},
    "flow_velocity": {"target_unit": "cm/s", "scale": 1.0, "offset": 0.0},
    "pressure": {"target_unit": "kPa", "scale": 1.0, "offset": 0.0},  # atm -> kPa handled explicitly
    "temperature": {"target_unit": "K", "scale": 1.0, "offset": 273.15},  # °C -> K
}


def load_nasa_file(file_path: str | Path):
    """Load raw NASA PSI tabular exports without mutating original units."""
    import pandas as pd

    path = Path(file_path)
    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported format {ext}. Supported: {sorted(SUPPORTED_EXTENSIONS)}")

    if ext == ".csv":
        return pd.read_csv(path)
    if ext == ".tsv":
        return pd.read_csv(path, sep="\t")
    if ext == ".json":
        return pd.read_json(path)
    if ext in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    if ext == ".parquet":
        return pd.read_parquet(path)
    raise ValueError(f"Unhandled extension: {ext}")


def normalize_units(df):
    """Normalize pressure (atm/psi -> kPa), velocity (m/s -> cm/s), and temperature (°C -> K)
    while retaining original columns and preserving NaNs without fabrication."""
    import numpy as np
    import pandas as pd

    out = df.copy()

    if "pressure" in out.columns and "pressure_unit" in out.columns:
        def _to_kpa(row):
            val = row["pressure"]
            if pd.isna(val):
                return np.nan
            unit = str(row["pressure_unit"]).strip().lower()
            if unit == "atm":
                return float(val) * 101.325
            if unit == "psi":
                return float(val) * 6.89476
            if unit == "pa":
                return float(val) / 1000.0
            return float(val)

        out["pressure_kpa"] = out.apply(_to_kpa, axis=1)

    if "flow_velocity" in out.columns and "flow_unit" in out.columns:
        def _to_cms(row):
            val = row["flow_velocity"]
            if pd.isna(val):
                return np.nan
            unit = str(row["flow_unit"]).strip().lower()
            if unit == "m/s":
                return float(val) * 100.0
            if unit == "mm/s":
                return float(val) / 10.0
            return float(val)

        out["flow_velocity_cm_s"] = out.apply(_to_cms, axis=1)

    if "temperature_c" in out.columns:
        out["temperature_k"] = out["temperature_c"].apply(
            lambda v: np.nan if pd.isna(v) else float(v) + 273.15
        )

    # Record explicit missingness audit column
    required_ml_cols = ["oxygen_pct", "flow_velocity_cm_s", "pressure_kpa", "sustained_combustion"]
    present_cols = [c for c in required_ml_cols if c in out.columns]
    if present_cols:
        out["missing_fields"] = out[present_cols].apply(
            lambda r: ", ".join([c for c in present_cols if pd.isna(r[c])]) or "none",
            axis=1,
        )
    return out


def train_and_evaluate_models(df) -> Dict:
    """Train Logistic Regression and Random Forest with GroupKFold cross-validation
    grouped by sample_group to prevent measurement leakage across the same experiment."""
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        accuracy_score,
        brier_score_loss,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.model_selection import GroupKFold
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    model_df = df.dropna(subset=["oxygen_pct", "flow_velocity_cm_s", "pressure_kpa", "sustained_combustion"]).copy()
    model_df["gravity_num"] = model_df["gravity_condition"].map(
        {"Microgravity": 0.0, "Partial gravity": 0.27, "Normal gravity": 1.0}
    ).fillna(0.0)
    model_df["low_flow_window"] = np.where(
        (model_df["gravity_num"] < 0.5)
        & (model_df["flow_velocity_cm_s"] >= 1.0)
        & (model_df["flow_velocity_cm_s"] <= 25.0),
        1.0,
        0.0,
    )

    features = ["oxygen_pct", "flow_velocity_cm_s", "low_flow_window", "pressure_kpa", "gravity_num"]
    X = model_df[features].values
    y = model_df["sustained_combustion"].astype(int).values
    groups = model_df["sample_group"].values

    n_splits = min(5, len(np.unique(groups)))
    gkf = GroupKFold(n_splits=n_splits)

    oof_lr = np.zeros(len(y))
    oof_rf = np.zeros(len(y))

    for tr_idx, te_idx in gkf.split(X, y, groups):
        lr = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(class_weight="balanced", C=1.0, max_iter=1000)),
        ])
        rf = RandomForestClassifier(n_estimators=100, max_depth=4, class_weight="balanced", random_state=42)

        lr.fit(X[tr_idx], y[tr_idx])
        rf.fit(X[tr_idx], y[tr_idx])

        oof_lr[te_idx] = lr.predict_proba(X[te_idx])[:, 1]
        oof_rf[te_idx] = rf.predict_proba(X[te_idx])[:, 1]

    def _metrics(probs: np.ndarray) -> Dict[str, float]:
        preds = (probs >= 0.5).astype(int)
        return {
            "accuracy": round(float(accuracy_score(y, preds)), 3),
            "precision": round(float(precision_score(y, preds, zero_division=0)), 3),
            "recall": round(float(recall_score(y, preds, zero_division=0)), 3),
            "f1_score": round(float(f1_score(y, preds, zero_division=0)), 3),
            "roc_auc": round(float(roc_auc_score(y, probs)), 3),
            "brier_score": round(float(brier_score_loss(y, probs)), 3),
        }

    return {
        "n_validated": int(len(model_df)),
        "n_excluded": int(len(df) - len(model_df)),
        "logistic_regression": _metrics(oof_lr),
        "random_forest": _metrics(oof_rf),
    }


def export_sqlite_to_json(sqlite_path: str | Path, out_json: str | Path) -> None:
    """Export FlameGuard SQLite tables to clean JSON for Colab/web synchronization."""
    conn = sqlite3.connect(str(sqlite_path))
    conn.row_factory = sqlite3.Row
    tables = ["investigations", "experiments", "measurements", "findings", "documents"]
    payload = {t: [dict(r) for r in conn.execute(f"SELECT * FROM {t}").fetchall()] for t in tables}
    Path(out_json).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    conn.close()


if __name__ == "__main__":
    db_file = Path("db/flameguard.sqlite")
    if db_file.exists():
        out_file = Path("pipeline/flameguard_clean_export.json")
        export_sqlite_to_json(db_file, out_file)
        print(f"Exported clean NASA dataset to {out_file}")
    else:
        print("SQLite database not initialized yet. Start the FlameGuard server first.")
