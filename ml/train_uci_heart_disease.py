"""Train and evaluate supplementary CAD candidates on UCI Heart Disease.

The four UCI source cohorts are evaluated with leave-one-cohort-out splits.
This is a separate study from the organizer-data models: the schemas differ,
so these artifacts must not be wired into the existing application contract.
The post-angiography ``ca`` feature is excluded to avoid target-time leakage.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "interim" / "uci_heart_disease_45.csv"
OUTPUT_DIR = ROOT / "artifacts" / "uci_heart_disease_45"
REPORT_PATH = ROOT / "reports" / "uci_heart_disease_45_model_study.json"
REPORT_MD_PATH = ROOT / "reports" / "uci_heart_disease_45_model_study.md"
NUMERIC = ["age", "trestbps", "chol", "thalach", "oldpeak"]
CATEGORICAL = ["sex", "cp", "fbs", "restecg", "exang", "slope", "thal"]
FEATURES = NUMERIC + CATEGORICAL
COHORTS = ["cleveland", "hungary", "switzerland", "long_beach_va"]
SEED = 2026


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_pipeline(estimator: Any) -> Pipeline:
    numeric = Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("scale", StandardScaler()),
    ])
    categorical = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])
    prep = ColumnTransformer([
        ("numeric", numeric, NUMERIC),
        ("categorical", categorical, CATEGORICAL),
    ])
    return Pipeline([("preprocess", prep), ("model", estimator)])


def evaluate(y_true: np.ndarray, probabilities: np.ndarray) -> dict[str, float | int | None]:
    pred = (probabilities >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
    return {
        "n": int(len(y_true)),
        "positive": int(y_true.sum()),
        "negative": int(len(y_true) - y_true.sum()),
        "roc_auc": float(roc_auc_score(y_true, probabilities)) if len(np.unique(y_true)) == 2 else None,
        "average_precision": float(average_precision_score(y_true, probabilities)),
        "brier_score": float(brier_score_loss(y_true, probabilities)),
        "accuracy_at_0_5": float(accuracy_score(y_true, pred)),
        "precision_at_0_5": float(precision_score(y_true, pred, zero_division=0)),
        "sensitivity_at_0_5": float(recall_score(y_true, pred, zero_division=0)),
        "specificity_at_0_5": float(tn / (tn + fp)) if tn + fp else None,
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def run() -> dict[str, Any]:
    if not DATA_PATH.is_file():
        raise FileNotFoundError(f"Run the UCI ETL first: {DATA_PATH}")
    frame = pd.read_csv(DATA_PATH)
    required = set(FEATURES + ["cad", "source_cohort"])
    if not required.issubset(frame.columns):
        raise ValueError(f"Dataset is missing required columns: {sorted(required - set(frame.columns))}")
    if set(frame["source_cohort"].unique()) != set(COHORTS):
        raise ValueError("Unexpected or missing source cohort labels")
    x_all = frame[FEATURES]
    y_all = frame["cad"].astype(int).to_numpy()
    results: dict[str, Any] = {}
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    estimators = {
        "logistic_regression": LogisticRegression(max_iter=3000, class_weight="balanced", random_state=SEED),
        "random_forest": RandomForestClassifier(
            n_estimators=500, min_samples_leaf=3, max_features="sqrt",
            class_weight="balanced_subsample", random_state=SEED, n_jobs=-1,
        ),
    }
    for model_name, estimator in estimators.items():
        fold_results: dict[str, Any] = {}
        oof_y: list[int] = []
        oof_p: list[float] = []
        for cohort in COHORTS:
            test_mask = frame["source_cohort"].eq(cohort).to_numpy()
            train_mask = ~test_mask
            model = make_pipeline(estimator)
            model.fit(x_all.loc[train_mask], y_all[train_mask])
            probs = model.predict_proba(x_all.loc[test_mask])[:, 1]
            ys = y_all[test_mask]
            fold_results[cohort] = evaluate(ys, probs)
            oof_y.extend(ys.tolist())
            oof_p.extend(probs.tolist())
        results[model_name] = {
            "protocol": "leave-one-source-cohort-out; each cohort predicted only by a model trained on the other three",
            "threshold": 0.5,
            "cohorts": fold_results,
            "pooled_out_of_fold": evaluate(np.asarray(oof_y), np.asarray(oof_p)),
        }

        # Final all-cohort artifact is for reproducible research only. It is
        # never used to generate the held-out metrics above.
        final_model = make_pipeline(estimator)
        final_model.fit(x_all, y_all)
        artifact = OUTPUT_DIR / f"{model_name}.joblib"
        joblib.dump(final_model, artifact)
        results[model_name]["all_data_artifact"] = str(artifact.relative_to(ROOT)).replace("\\", "/")

    report: dict[str, Any] = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": "UCI Heart Disease (dataset 45), four processed cohorts; CAD=1 for num>0",
        "dataset_path": str(DATA_PATH.relative_to(ROOT)).replace("\\", "/"),
        "dataset_sha256": sha256(DATA_PATH),
        "rows": len(frame),
        "features": FEATURES,
        "excluded_feature": {"ca": "number of major vessels colored by fluoroscopy; post-angiography and unsuitable for pre-test prediction"},
        "target": "cad; derived from num (0=no disease; 1-4 disease severity) by ETL",
        "models": results,
        "compatibility": "Research-only separate CAD candidate. Not input-compatible with the organizer dataset's 55-feature four-target models; do not integrate into the app contract without a validated feature crosswalk and new evaluation.",
        "limitations": [
            "Source cohort held out, but the source datasets are historical and heterogeneous; this is not prospective or clinical validation.",
            "A pooled score can hide major cohort-specific failures; inspect each cohort row.",
            "Threshold 0.5 is fixed for transparent comparison, not tuned for clinical use.",
            "UCI label documentation uses a >50% stenosis rule; the dataset 411 organizer label definition may use a slightly different threshold.",
            "All-data artifacts are refit on all four cohorts for reproducibility and must not be used to claim the reported held-out performance.",
        ],
        "software": {"python": "runtime", "scikit_learn": sklearn.__version__, "pandas": pd.__version__},
        "seed": SEED,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    lines = [
        "# UCI Heart Disease CAD model study", "",
        f"Rows: {len(frame)}. Features: {', '.join(FEATURES)}. Excluded `ca` (post-angiography).", "",
        "Evaluation protocol: leave one source cohort out; preprocessing is refit on the other three cohorts for each fold. Threshold 0.5 is fixed. Metrics are exploratory, not clinical validation.", "",
        "| Model | Held-out cohort | N | ROC AUC | AP | Brier | Sensitivity | Specificity |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for model_name, values in results.items():
        for cohort, metrics in values["cohorts"].items():
            auc = "NA" if metrics["roc_auc"] is None else f"{metrics['roc_auc']:.3f}"
            spec = "NA" if metrics["specificity_at_0_5"] is None else f"{metrics['specificity_at_0_5']:.3f}"
            lines.append(f"| {model_name} | {cohort} | {metrics['n']} | {auc} | {metrics['average_precision']:.3f} | {metrics['brier_score']:.3f} | {metrics['sensitivity_at_0_5']:.3f} | {spec} |")
        m = values["pooled_out_of_fold"]
        lines.append(f"| {model_name} | Pooled OOF | {m['n']} | {m['roc_auc']:.3f} | {m['average_precision']:.3f} | {m['brier_score']:.3f} | {m['sensitivity_at_0_5']:.3f} | {m['specificity_at_0_5']:.3f} |")
    lines += ["", "## Compatibility", "", report["compatibility"], "", "## Limitations", ""]
    lines += [f"- {item}" for item in report["limitations"]]
    REPORT_MD_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    outcome = run()
    for name, values in outcome["models"].items():
        pooled = values["pooled_out_of_fold"]
        print(f"{name}: pooled OOF AUC={pooled['roc_auc']:.3f}, Brier={pooled['brier_score']:.3f}; report={REPORT_MD_PATH}")
