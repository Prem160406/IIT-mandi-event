"""Evaluate leakage-safe baselines and compare a predeclared tree candidate.

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
from sklearn.calibration import CalibratedClassifierCV
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import (
    RepeatedStratifiedKFold,
    StratifiedShuffleSplit,
    StratifiedKFold,
    cross_val_predict,
    cross_validate,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ml.data_prep import DEFAULT_DATA_PATH, DEFAULT_TARGET_CONFIG, build_xy, load_dataset, load_target_config
from ml.explain import summarize_global_contributions


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "artifacts" / "baseline"
DEFAULT_FEATURE_CONFIG = ROOT / "config" / "features.yaml"
SEED = 2026
TEST_SIZE = 0.20
THRESHOLD = 0.5
BOOTSTRAP_REPLICATES = 2000
RECORDED_PACKAGES = (
    "cloudpickle", "contourpy", "cycler", "et-xmlfile", "fonttools", "joblib", "kiwisolver",
    "matplotlib", "narwhals", "numpy", "openpyxl", "packaging", "pandas", "pillow", "pyparsing",
    "python-dateutil", "pytz", "PyYAML", "scikit-learn", "scipy", "six", "threadpoolctl", "tzdata",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_report_figures(plot_data: dict[str, dict[str, Any]], results: list[dict[str, Any]]) -> list[str]:
    """Create report-ready holdout ROC, calibration, confusion and global-contribution figures."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.calibration import calibration_curve

    figure_dir = ROOT / "reports" / "figures"
    figure_dir.mkdir(parents=True, exist_ok=True)
    targets = list(plot_data)
    figure_files = []

    fig, axes = plt.subplots(2, 2, figsize=(10, 8), constrained_layout=True)
    for ax, target in zip(axes.flat, targets):
        values = plot_data[target]
        for label, key in (("Raw logistic", "raw_probabilities"), ("Sigmoid calibrated", "calibrated_probabilities")):
            fpr, tpr, _ = roc_curve(values["y_true"], values[key])
            auc = roc_auc_score(values["y_true"], values[key])
            ax.plot(fpr, tpr, label=f"{label} (AUC={auc:.2f})")
        ax.plot([0, 1], [0, 1], color="gray", linestyle="--", linewidth=1)
        ax.set(title=target, xlabel="False-positive rate", ylabel="Sensitivity")
        ax.legend(fontsize=8, loc="lower right")
    fig.suptitle("Holdout ROC curves (61 records per target; exploratory)")
    path = figure_dir / "holdout_roc.png"
    fig.savefig(path, dpi=180)
    plt.close(fig)
    figure_files.append(str(path.relative_to(ROOT)).replace("\\", "/"))

    fig, axes = plt.subplots(2, 2, figsize=(10, 8), constrained_layout=True)
    for ax, target in zip(axes.flat, targets):
        values = plot_data[target]
        for label, key in (("Raw logistic", "raw_probabilities"), ("Sigmoid calibrated", "calibrated_probabilities")):
            fraction_positive, mean_predicted = calibration_curve(
                values["y_true"], values[key], n_bins=5, strategy="quantile"
            )
            ax.plot(mean_predicted, fraction_positive, marker="o", label=label)
        ax.plot([0, 1], [0, 1], color="gray", linestyle="--", linewidth=1)
        ax.set(title=target, xlabel="Mean predicted probability", ylabel="Observed positive fraction", xlim=(0, 1), ylim=(0, 1))
        ax.legend(fontsize=8, loc="upper left")
    fig.suptitle("Holdout calibration curves (quantile bins; exploratory)")
    path = figure_dir / "holdout_calibration.png"
    fig.savefig(path, dpi=180)
    plt.close(fig)
    figure_files.append(str(path.relative_to(ROOT)).replace("\\", "/"))

    fig, axes = plt.subplots(2, 2, figsize=(10, 8), constrained_layout=True)
    for ax, target in zip(axes.flat, targets):
        matrix = np.asarray(plot_data[target]["raw_confusion_matrix"])
        ax.imshow(matrix, cmap="Blues")
        for (row, column), value in np.ndenumerate(matrix):
            ax.text(column, row, str(value), ha="center", va="center", color="black")
        ax.set(title=target, xlabel="Predicted (0=negative, 1=positive)", ylabel="Observed (0=negative, 1=positive)", xticks=[0, 1], yticks=[0, 1])
    fig.suptitle("Raw logistic holdout confusion matrices at threshold 0.5")
    path = figure_dir / "holdout_confusion_matrices.png"
    fig.savefig(path, dpi=180)
    plt.close(fig)
    figure_files.append(str(path.relative_to(ROOT)).replace("\\", "/"))

    fig, axes = plt.subplots(2, 2, figsize=(11, 9), constrained_layout=True)
    for ax, result in zip(axes.flat, results):
        top = result["global_feature_contributions"][:10][::-1]
        ax.barh([item["feature"] for item in top], [item["mean_absolute_log_odds_contribution"] for item in top])
        ax.set(title=result["target"], xlabel="Mean absolute contribution (log-odds)")
    fig.suptitle("Global raw-logistic model contributions on training records")
    path = figure_dir / "global_logistic_contributions.png"
    fig.savefig(path, dpi=180)
    plt.close(fig)
    figure_files.append(str(path.relative_to(ROOT)).replace("\\", "/"))
    return figure_files


def load_feature_groups(path: Path = DEFAULT_FEATURE_CONFIG) -> dict[str, list[str]]:
    """Load feature ablation groups from the shared feature registry."""
    import yaml

    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    features = config.get("features") if isinstance(config, dict) else None
    if not isinstance(features, list):
        raise ValueError(f"Invalid feature configuration: {path}")
    groups: dict[str, list[str]] = {}
    for feature in features:
        if not isinstance(feature, dict) or not feature.get("name") or not feature.get("group"):
            raise ValueError(f"Invalid feature entry in {path}: {feature!r}")
        groups.setdefault(str(feature["group"]), []).append(str(feature["name"]))
    return groups


def make_pipeline(X: pd.DataFrame, *, classifier_name: str = "logistic") -> Pipeline:
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
    if classifier_name == "logistic":
        classifier = LogisticRegression(
            C=1.0,
            class_weight="balanced",
            max_iter=3000,
            solver="liblinear",
            random_state=SEED,
        )
    elif classifier_name == "random_forest":
        classifier = RandomForestClassifier(
            n_estimators=300,
            max_features="sqrt",
            min_samples_leaf=3,
            class_weight="balanced_subsample",
            n_jobs=1,
            random_state=SEED,
        )
    else:
        raise ValueError(f"Unknown classifier: {classifier_name}")
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


def stratified_bootstrap_brier_difference(
    y_true: pd.Series | np.ndarray,
    raw_probabilities: np.ndarray,
    calibrated_probabilities: np.ndarray,
    *,
    seed: int,
) -> dict[str, float]:
    """CI for paired Brier-score difference (calibrated minus raw)."""
    y = np.asarray(y_true, dtype="int8")
    raw = np.asarray(raw_probabilities, dtype="float64")
    calibrated = np.asarray(calibrated_probabilities, dtype="float64")
    class_indices = [np.flatnonzero(y == label) for label in (0, 1)]
    if any(indices.size == 0 for indices in class_indices):
        raise ValueError("Stratified bootstrap requires both classes in the holdout")
    rng = np.random.default_rng(seed)
    differences = np.empty(BOOTSTRAP_REPLICATES, dtype="float64")
    for replicate in range(BOOTSTRAP_REPLICATES):
        sampled = np.concatenate(
            [rng.choice(indices, size=indices.size, replace=True) for indices in class_indices]
        )
        differences[replicate] = brier_score_loss(y[sampled], calibrated[sampled]) - brier_score_loss(
            y[sampled], raw[sampled]
        )
    point_difference = brier_score_loss(y, calibrated) - brier_score_loss(y, raw)
    return {
        "point_estimate_calibrated_minus_raw": float(point_difference),
        "lower_95": float(np.quantile(differences, 0.025)),
        "upper_95": float(np.quantile(differences, 0.975)),
    }


def split_sensitivity(
    X: pd.DataFrame,
    y: pd.Series,
    *,
    repeats: int = 25,
) -> dict[str, Any]:
    """Measure fixed-model score variation over repeated stratified 80/20 splits."""
    splitter = StratifiedShuffleSplit(n_splits=repeats, test_size=TEST_SIZE, random_state=SEED)
    metric_names = ("roc_auc", "sensitivity", "specificity", "f1", "brier_score")
    values: dict[str, list[float]] = {name: [] for name in metric_names}
    run_records = []
    for split_number, (train_indices, test_indices) in enumerate(splitter.split(X, y), start=1):
        model = make_pipeline(X.iloc[train_indices], classifier_name="logistic")
        y_train = y.iloc[train_indices]
        y_test = y.iloc[test_indices]
        model.fit(X.iloc[train_indices], y_train)
        probabilities = model.predict_proba(X.iloc[test_indices])[:, 1]
        result = metrics(y_test, probabilities)
        selected = {
            "roc_auc": result["roc_auc"],
            "sensitivity": result["recall_sensitivity"],
            "specificity": result["specificity"],
            "f1": result["f1"],
            "brier_score": result["brier_score"],
        }
        for name, value in selected.items():
            values[name].append(float(value))
        run_records.append(
            {
                "split_number": split_number,
                "train_row_indices_zero_based": X.index[train_indices].tolist(),
                "holdout_row_indices_zero_based": X.index[test_indices].tolist(),
                "metrics": selected,
            }
        )

    return {
        "method": "25 repeated stratified 80/20 splits using the fixed logistic-regression specification",
        "seed": SEED,
        "interpretation": "Between-split empirical spread, not a confidence interval; splits overlap and are dependent.",
        "summary": {
            name: {
                "mean": float(np.mean(samples)),
                "std": float(np.std(samples, ddof=1)),
                "q05": float(np.quantile(samples, 0.05)),
                "q95": float(np.quantile(samples, 0.95)),
            }
            for name, samples in values.items()
        },
        "runs": run_records,
    }


def cross_fitted_calibrated_probabilities(X: pd.DataFrame, y: pd.Series) -> np.ndarray:
    """Nested cross-fitted sigmoid probabilities, with no row used to fit its prediction."""
    outer_cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED + 1)
    probabilities = np.full(len(y), np.nan, dtype="float64")
    for fold_number, (fit_indices, validation_indices) in enumerate(outer_cv.split(X, y)):
        inner_cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED + 10 + fold_number)
        calibrated = CalibratedClassifierCV(
            estimator=make_pipeline(X.iloc[fit_indices], classifier_name="logistic"),
            method="sigmoid",
            cv=inner_cv,
        )
        calibrated.fit(X.iloc[fit_indices], y.iloc[fit_indices])
        probabilities[validation_indices] = calibrated.predict_proba(X.iloc[validation_indices])[:, 1]
    if np.isnan(probabilities).any():
        raise RuntimeError("Nested calibration did not produce an out-of-fold prediction for every row")
    return probabilities


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
    repeated_cv_splits = list(cv.split(X_train, y_train))
    scoring = {"roc_auc": "roc_auc", "f1": "f1", "recall": "recall"}
    estimator = make_pipeline(X_train, classifier_name="logistic")
    logistic_scores = cross_validate(
        estimator, X_train, y_train, cv=repeated_cv_splits, scoring=scoring, n_jobs=1, error_score="raise"
    )
    forest_scores = cross_validate(
        make_pipeline(X_train, classifier_name="random_forest"),
        X_train,
        y_train,
        cv=repeated_cv_splits,
        scoring=scoring,
        n_jobs=1,
        error_score="raise",
    )
    feature_groups = load_feature_groups()
    configured_features = {name for names in feature_groups.values() for name in names}
    if configured_features != set(X.columns):
        raise ValueError(
            "Feature-group configuration must cover predictors exactly; "
            f"missing={sorted(set(X.columns) - configured_features)}, "
            f"extra={sorted(configured_features - set(X.columns))}"
        )
    ablation_results = {}
    full_auc_scores = logistic_scores["test_roc_auc"]
    for group_name, columns_to_remove in feature_groups.items():
        X_ablated = X_train.drop(columns=columns_to_remove)
        ablation_scores = cross_validate(
            make_pipeline(X_ablated, classifier_name="logistic"),
            X_ablated,
            y_train,
            cv=repeated_cv_splits,
            scoring=scoring,
            n_jobs=1,
            error_score="raise",
        )
        paired_delta = ablation_scores["test_roc_auc"] - full_auc_scores
        ablation_results[group_name] = {
            "removed_feature_count": len(columns_to_remove),
            "removed_features": columns_to_remove,
            "roc_auc_mean": float(np.mean(ablation_scores["test_roc_auc"])),
            "roc_auc_std": float(np.std(ablation_scores["test_roc_auc"], ddof=1)),
            "roc_auc_delta_vs_full_mean": float(np.mean(paired_delta)),
            "paired_fold_delta_std": float(np.std(paired_delta, ddof=1)),
            "folds_ablation_higher": int(np.sum(paired_delta > 0)),
            "folds_compared": int(len(repeated_cv_splits)),
            "f1_mean": float(np.mean(ablation_scores["test_f1"])),
            "recall_mean": float(np.mean(ablation_scores["test_recall"])),
        }
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
    calibrated_oof_probabilities = cross_fitted_calibrated_probabilities(X_train, y_train)
    calibrated_threshold_table = [
        metrics(y_train, calibrated_oof_probabilities, threshold=threshold)
        for threshold in (0.05, 0.10, 0.20, 0.30, 0.40, 0.50)
    ]
    split_sensitivity_results = split_sensitivity(X, y)

    estimator.fit(X_train, y_train)
    global_contributions = summarize_global_contributions(X_train, model=estimator)
    test_probabilities = estimator.predict_proba(X_test)[:, 1]
    holdout = metrics(y_test, test_probabilities)
    target_seed = SEED + ("CAD", "LAD", "LCX", "RCA").index(target)
    holdout["stratified_bootstrap_95_ci"] = stratified_bootstrap_intervals(
        y_test, test_probabilities, seed=target_seed
    )
    model_path = output_dir / f"{target.lower()}_logistic.joblib"
    joblib.dump(estimator, model_path)

    calibration_cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    calibrated_estimator = CalibratedClassifierCV(
        estimator=make_pipeline(X_train, classifier_name="logistic"),
        method="sigmoid",
        cv=calibration_cv,
    )
    calibrated_estimator.fit(X_train, y_train)
    calibrated_probabilities = calibrated_estimator.predict_proba(X_test)[:, 1]
    calibrated_holdout = metrics(y_test, calibrated_probabilities)
    calibrated_holdout["stratified_bootstrap_95_ci"] = stratified_bootstrap_intervals(
        y_test, calibrated_probabilities, seed=target_seed + 100
    )
    brier_difference = stratified_bootstrap_brier_difference(
        y_test, test_probabilities, calibrated_probabilities, seed=target_seed + 200
    )
    calibrated_model_path = output_dir / f"{target.lower()}_logistic_sigmoid_calibrated.joblib"
    joblib.dump(calibrated_estimator, calibrated_model_path)

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
        "global_feature_contributions": global_contributions,
        "excluded_outcome_columns": sorted(outcomes),
        "cross_validation": {
            "scheme": "5-fold stratified CV repeated 3 times on training partition only",
            "seed": SEED,
            "candidates": {
                "logistic_regression": {
                    name: {"mean": float(np.mean(logistic_scores[f"test_{name}"])), "std": float(np.std(logistic_scores[f"test_{name}"], ddof=1))}
                    for name in ("roc_auc", "f1", "recall")
                },
                "random_forest": {
                    name: {"mean": float(np.mean(forest_scores[f"test_{name}"])), "std": float(np.std(forest_scores[f"test_{name}"], ddof=1))}
                    for name in ("roc_auc", "f1", "recall")
                },
            },
            "paired_roc_auc_difference_random_forest_minus_logistic": {
                "mean": float(np.mean(forest_scores["test_roc_auc"] - logistic_scores["test_roc_auc"])),
                "std": float(np.std(forest_scores["test_roc_auc"] - logistic_scores["test_roc_auc"], ddof=1)),
                "folds_random_forest_higher": int(np.sum(forest_scores["test_roc_auc"] > logistic_scores["test_roc_auc"])),
                "folds_compared": int(len(repeated_cv_splits)),
            },
        },
        "feature_group_ablation": {
            "source": "config/features.yaml",
            "method": "Remove one configured feature group at a time; compare logistic-regression CV on the exact same training folds.",
            "interpretation": "Exploratory predictive ablation, not causal importance; groups may be correlated or redundant.",
            "full_model_roc_auc_mean": float(np.mean(full_auc_scores)),
            "groups": ablation_results,
        },
        "training_only_threshold_tradeoffs": {
            "source": "single 5-fold stratified out-of-fold predictions on training partition only",
            "warning": "Descriptive trade-offs only; thresholds have not been selected for a clinical use.",
            "table": threshold_table,
        },
        "training_only_calibrated_threshold_tradeoffs": {
            "source": "nested cross-fitted sigmoid probabilities on training partition: 5 outer folds, each with 5-fold calibration on outer-training rows",
            "warning": "Descriptive trade-offs only; no operating threshold is selected for clinical use.",
            "table": calibrated_threshold_table,
        },
        "split_sensitivity": split_sensitivity_results,
        "holdout_metrics": holdout,
        "sigmoid_calibrated_holdout_metrics": calibrated_holdout,
        "calibration_method": {
            "method": "sigmoid (Platt) calibration",
            "fit": "CalibratedClassifierCV with 5 stratified folds on training partition only",
            "holdout_used_for_fit_or_selection": False,
            "paired_brier_difference_calibrated_minus_raw": brier_difference,
            "calibrated_model_file": calibrated_model_path.name,
            "calibrated_model_sha256": sha256(calibrated_model_path),
        },
        "holdout_uncertainty_method": (
            f"{BOOTSTRAP_REPLICATES} stratified percentile bootstrap replicates, resampling separately "
            "within each holdout class; conditional on holdout class counts"
        ),
        "calibration": "Raw and sigmoid-calibrated probabilities are both reported; calibration is experimental and not selected based on holdout results.",
        "model_file": model_path.name,
        "model_sha256": sha256(model_path),
        "versions": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "packages": {name: importlib.metadata.version(name) for name in RECORDED_PACKAGES},
        },
        "_plot_data": {
            "y_true": y_test.astype("int8").tolist(),
            "raw_probabilities": test_probabilities.astype("float64").tolist(),
            "calibrated_probabilities": calibrated_probabilities.astype("float64").tolist(),
            "raw_confusion_matrix": holdout["confusion_matrix_labels_0_1"],
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
    plot_data = {result["target"]: result.pop("_plot_data") for result in results}
    figure_files = save_report_figures(plot_data, results)
    report = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "purpose": "Internal baseline only; not for diagnosis or treatment decisions.",
        "protocol": {
            "split": f"stratified {1 - TEST_SIZE:.0%}/{TEST_SIZE:.0%} train/holdout",
            "seed": SEED,
            "decision_threshold": THRESHOLD,
            "models_compared": {
                "logistic_regression": "L2-regularized, class_weight=balanced, C=1.0",
                "random_forest": "300 trees, max_features=sqrt, min_samples_leaf=3, class_weight=balanced_subsample",
            },
            "selection": "Predeclared comparison on repeated CV of training partition only; holdout is reserved for the logistic baseline and not used to select between candidates.",
        },
        "figures": figure_files,
        "targets": results,
    }
    report_path = args.output / "evaluation.json"
    report_text = json.dumps(report, indent=2)
    report_path.write_text(report_text, encoding="utf-8")
    metrics_path = ROOT / "reports" / "metrics.json"
    metrics_path.write_text(report_text, encoding="utf-8")
    print(f"Saved baseline models to {args.output}; evaluation report to {report_path} and {metrics_path}")


if __name__ == "__main__":
    main()
