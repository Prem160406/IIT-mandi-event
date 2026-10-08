"""Train and evaluate leakage-safe logistic-regression baselines.

This is an internal prototype baseline, not a clinical model. The holdout is
reserved for one final evaluation; preprocessing is fitted within each fold.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import (
    RepeatedStratifiedKFold,
    StratifiedKFold,
    cross_val_predict,
    cross_validate,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ml.data_prep import DEFAULT_DATA_PATH, DEFAULT_TARGET_CONFIG, build_xy, load_dataset, load_target_config


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "artifacts" / "baseline"
SEED = 2026
TEST_SIZE = 0.20
THRESHOLD = 0.5
BOOTSTRAP_REPLICATES = 2000
RECORDED_PACKAGES = (
    "cloudpickle", "et-xmlfile", "joblib", "narwhals", "numpy", "openpyxl", "pandas",
    "python-dateutil", "pytz", "PyYAML", "scikit-learn", "scipy", "six", "threadpoolctl", "tzdata",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def make_pipeline(X: pd.DataFrame) -> Pipeline:
    """Infer numeric and categorical columns, fitting all transforms in-pipeline."""
    numeric = X.select_dtypes(include=["number"]).columns.tolist()
    categorical = [column for column in X.columns if column not in numeric]
    transformers: list[tuple[str, Any, list[str]]] = []
    if numeric:
        numeric_pipe = Pipeline(
            [
                ("impute", SimpleImputer(strategy="median", add_indicator=True)),
                ("scale", StandardScaler()),
            ]
        )
        transformers.append(("numeric", numeric_pipe, numeric))
    if categorical:
        categorical_pipe = Pipeline(
            [
                ("impute", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore")),
            ]
        )
        transformers.append(("categorical", categorical_pipe, categorical))
    if not transformers:
        raise ValueError("No predictor columns available after leakage removal")

    preprocess = ColumnTransformer(transformers=transformers, remainder="drop")
    classifier = LogisticRegression(
        C=1.0,
        class_weight="balanced",
        max_iter=3000,
        solver="liblinear",
        random_state=SEED,
    )
    return Pipeline([("preprocess", preprocess), ("classifier", classifier)])


def metrics(
    y_true: pd.Series | np.ndarray,
    probabilities: np.ndarray,
    *,
    threshold: float = THRESHOLD,
) -> dict[str, Any]:
    predictions = (probabilities >= threshold).astype("int8")
    matrix = confusion_matrix(y_true, predictions, labels=[0, 1])
    return {
        "threshold": threshold,
        "predicted_positive_rate": float(predictions.mean()),
        "accuracy": float(accuracy_score(y_true, predictions)),
        "precision": float(precision_score(y_true, predictions, zero_division=0)),
        "recall_sensitivity": float(recall_score(y_true, predictions, zero_division=0)),
        "specificity": float(matrix[0, 0] / matrix[0].sum()) if matrix[0].sum() else None,
        "f1": float(f1_score(y_true, predictions, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "brier_score": float(brier_score_loss(y_true, probabilities)),
        "confusion_matrix_labels_0_1": matrix.tolist(),
    }


def stratified_bootstrap_intervals(
    y_true: pd.Series | np.ndarray,
    probabilities: np.ndarray,
    *,
    seed: int,
) -> dict[str, dict[str, float]]:
    """Percentile intervals, resampling within each observed class.

    These intervals quantify finite holdout sampling variation conditional on
    this holdout's class counts. They do not account for model-training or
    external-population uncertainty.
    """
    y = np.asarray(y_true, dtype="int8")
    p = np.asarray(probabilities, dtype="float64")
    class_indices = {label: np.flatnonzero(y == label) for label in (0, 1)}
    if any(indices.size == 0 for indices in class_indices.values()):
        raise ValueError("Stratified bootstrap requires both classes in the holdout")

    rng = np.random.default_rng(seed)
    names = ("accuracy", "precision", "recall_sensitivity", "specificity", "f1", "roc_auc", "brier_score")
    samples = {name: np.empty(BOOTSTRAP_REPLICATES, dtype="float64") for name in names}
    for replicate in range(BOOTSTRAP_REPLICATES):
        sampled = np.concatenate(
            [rng.choice(indices, size=indices.size, replace=True) for indices in class_indices.values()]
        )
        result = metrics(y[sampled], p[sampled])
        for name in names:
            samples[name][replicate] = result[name]

    return {
        name: {
            "lower_95": float(np.quantile(values, 0.025)),
            "upper_95": float(np.quantile(values, 0.975)),
        }
        for name, values in samples.items()
    }


def evaluate_target(
    frame: pd.DataFrame,
    target: str,
    target_config: dict[str, Any],
    dataset_path: Path,
    output_dir: Path,
) -> dict[str, Any]:
    X, y = build_xy(frame, target, target_config)
    outcomes = {"CAD", "LAD", "LCX", "RCA", "Cath"}
    leaked = outcomes.intersection(X.columns)
    if leaked:
        raise RuntimeError(f"Outcome leakage for {target}: {sorted(leaked)}")
    if y.nunique() != 2 or y.value_counts().min() < 6:
        raise ValueError(f"Target {target} does not have enough examples in both classes")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=SEED, stratify=y
    )
    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=SEED)
    estimator = make_pipeline(X_train)
    scores = cross_validate(
        estimator,
        X_train,
        y_train,
        cv=cv,
        scoring={"roc_auc": "roc_auc", "f1": "f1", "recall": "recall"},
        n_jobs=1,
        error_score="raise",
    )
    oof_cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    oof_probabilities = cross_val_predict(
        make_pipeline(X_train),
        X_train,
        y_train,
        cv=oof_cv,
        method="predict_proba",
        n_jobs=1,
        verbose=0,
    )[:, 1]
    threshold_table = [
        metrics(y_train, oof_probabilities, threshold=threshold)
        for threshold in (0.25, 0.35, 0.50, 0.65, 0.75)
    ]

    estimator.fit(X_train, y_train)
    test_probabilities = estimator.predict_proba(X_test)[:, 1]
    holdout = metrics(y_test, test_probabilities)
    target_seed = SEED + ("CAD", "LAD", "LCX", "RCA").index(target)
    holdout["stratified_bootstrap_95_ci"] = stratified_bootstrap_intervals(
        y_test, test_probabilities, seed=target_seed
    )
    model_path = output_dir / f"{target.lower()}_logistic.joblib"
    joblib.dump(estimator, model_path)

    spec = target_config["targets"][target]
    return {
        "target": target,
        "target_source_column": spec["source_column"],
        "positive_label": spec["positive_values"],
        "negative_label": spec["negative_values"],
        "dataset_sha256": sha256(dataset_path),
        "dataset_rows": int(len(frame)),
        "train_rows": int(len(X_train)),
        "holdout_rows": int(len(X_test)),
        "train_row_indices_zero_based": X_train.index.tolist(),
        "holdout_row_indices_zero_based": X_test.index.tolist(),
        "class_counts_full_dataset": {str(k): int(v) for k, v in y.value_counts().sort_index().items()},
        "predictor_count": int(X.shape[1]),
        "predictor_names": X.columns.tolist(),
        "excluded_outcome_columns": sorted(outcomes),
        "cross_validation": {
            "scheme": "5-fold stratified CV repeated 3 times on training partition only",
            "seed": SEED,
            "metrics_mean_std": {
                name: {"mean": float(np.mean(scores[f"test_{name}"])), "std": float(np.std(scores[f"test_{name}"], ddof=1))}
                for name in ("roc_auc", "f1", "recall")
            },
        },
        "training_only_threshold_tradeoffs": {
            "source": "single 5-fold stratified out-of-fold predictions on training partition only",
            "warning": "Descriptive trade-offs only; thresholds have not been selected for a clinical use.",
            "table": threshold_table,
        },
        "holdout_metrics": holdout,
        "holdout_uncertainty_method": (
            f"{BOOTSTRAP_REPLICATES} stratified percentile bootstrap replicates, resampling separately "
            "within each holdout class; conditional on holdout class counts"
        ),
        "calibration": "Not calibrated; Brier score is reported as a probability-quality baseline.",
        "model_file": model_path.name,
        "model_sha256": sha256(model_path),
        "versions": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "packages": {name: importlib.metadata.version(name) for name in RECORDED_PACKAGES},
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--targets", nargs="+", choices=["CAD", "LAD", "LCX", "RCA"], default=["CAD", "LAD", "LCX", "RCA"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    frame = load_dataset(args.data)
    target_config = load_target_config(DEFAULT_TARGET_CONFIG)
    results = [
        evaluate_target(frame, target, target_config, args.data, args.output)
        for target in args.targets
    ]
    report = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "purpose": "Internal baseline only; not for diagnosis or treatment decisions.",
        "protocol": {
            "split": f"stratified {1 - TEST_SIZE:.0%}/{TEST_SIZE:.0%} train/holdout",
            "seed": SEED,
            "decision_threshold": THRESHOLD,
            "model": "class-weighted L2-regularized logistic regression",
            "selection": "No hyperparameter selection; fixed baseline specification.",
        },
        "targets": results,
    }
    report_path = args.output / "evaluation.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Saved baseline models and evaluation report to {args.output}")


if __name__ == "__main__":
    main()
