"""Faithful local explanations for the saved logistic-regression pipelines.

Each feature contribution is an exact additive term in the classifier's
log-odds after the fitted preprocessing transform. It describes model behavior,
not causation or a medical mechanism.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

import joblib
import numpy as np
import pandas as pd
from scipy.special import expit
from scipy import sparse
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split

from ml.data_prep import OUTCOME_COLUMNS, build_xy, canonicalize_features, load_dataset


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "artifacts" / "baseline"
TARGETS = {"CAD", "LAD", "LCX", "RCA"}
LOGGER = logging.getLogger(__name__)
_SHAP_EXPLAINER_CACHE: dict[int, Any] = {}
BACKGROUND_ROWS = 50
TRAIN_TEST_SEED = 2026


@lru_cache(maxsize=len(TARGETS))
def load_training_background(target: str) -> pd.DataFrame:
    """Return a deterministic sample from that target's saved-model training split."""
    X, y = build_xy(load_dataset(), target.upper())
    training, _, _, _ = train_test_split(
        X, y, test_size=0.20, random_state=TRAIN_TEST_SEED, stratify=y
    )
    return training.sample(n=min(BACKGROUND_ROWS, len(training)), random_state=TRAIN_TEST_SEED).copy()


def compute_shap_attributions(
    model: Any,
    x: np.ndarray,
    background: np.ndarray,
    feature_names: list[str],
    *,
    feature_values: Mapping[str, Any] | None = None,
    feature_categories: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Compute exact interventional Linear SHAP values in log-odds space.

    ``feature_names`` maps transformed pipeline columns to source feature names;
    duplicate names (one-hot columns) are summed back to their source feature.
    """
    import shap

    row = np.asarray(x, dtype="float64").reshape(1, -1)
    reference = np.asarray(background, dtype="float64")
    if reference.ndim != 2 or reference.shape[1] != row.shape[1] or len(feature_names) != row.shape[1]:
        raise ValueError("Transformed row, background and feature-name dimensions must match")
    cache_key = id(model)
    explainer = _SHAP_EXPLAINER_CACHE.get(cache_key)
    if explainer is None:
        explainer = shap.LinearExplainer(model, shap.maskers.Independent(reference))
        _SHAP_EXPLAINER_CACHE[cache_key] = explainer

    explanation = explainer(row)
    shap_values = np.asarray(explanation.values, dtype="float64").reshape(-1)
    base_value = float(np.asarray(explanation.base_values, dtype="float64").reshape(-1)[0])
    grouped: dict[str, float] = {}
    for feature, value in zip(feature_names, shap_values):
        grouped[feature] = grouped.get(feature, 0.0) + float(value)
    values = feature_values or {}
    categories = feature_categories or {}
    contributions = [
        {
            "feature": feature,
            "category": categories.get(feature, ""),
            "input_value": values.get(feature),
            "shap_value": value,
            "direction": "raises_risk" if value > 0 else "lowers_risk" if value < 0 else "neutral",
        }
        for feature, value in grouped.items()
    ]
    contributions.sort(key=lambda item: abs(item["shap_value"]), reverse=True)
    return {"base_value": base_value, "feature_contributions": contributions}


def exact_centered_attributions(
    model: Any, x: np.ndarray, background: np.ndarray, feature_names: list[str]
) -> tuple[float, dict[str, float]]:
    """Closed-form exact linear attributions around a SHAP background mean."""
    row = np.asarray(x, dtype="float64").reshape(-1)
    reference = np.asarray(background, dtype="float64")
    if reference.ndim != 2 or reference.shape[1] != row.size or len(feature_names) != row.size:
        raise ValueError("Transformed row, background and feature-name dimensions must match")
    coefficients = np.asarray(model.coef_, dtype="float64")[0]
    mean = reference.mean(axis=0)
    centered = (row - mean) * coefficients
    exact: dict[str, float] = {}
    for feature, value in zip(feature_names, centered):
        exact[feature] = exact.get(feature, 0.0) + float(value)
    base_value = float(np.asarray(model.intercept_).ravel()[0] + np.dot(mean, coefficients))
    return base_value, exact


def verify_attribution_consistency(
    model: Any,
    x: np.ndarray,
    base_value: float,
    shap_values: Mapping[str, float],
    exact_values: Mapping[str, float],
    *,
    tolerance: float = 1e-6,
) -> None:
    """Assert SHAP additivity and agreement with centered exact coefficients."""
    row = np.asarray(x, dtype="float64").reshape(1, -1)
    score = float(np.asarray(model.decision_function(row)).reshape(-1)[0])
    total = float(base_value + sum(shap_values.values()))
    assert np.isclose(total, score, atol=tolerance, rtol=0), (
        f"base value + SHAP values ({total}) does not match model log-odds ({score})"
    )
    assert set(shap_values) == set(exact_values), "SHAP and exact attribution feature sets differ"
    for feature, shap_value in shap_values.items():
        assert np.isclose(shap_value, exact_values[feature], atol=tolerance, rtol=0), (
            f"SHAP and exact attributions diverge for {feature}: {shap_value} vs {exact_values[feature]}"
        )


def explain_shap_one(
    target: str,
    row: Mapping[str, Any] | pd.DataFrame,
    *,
    model: Pipeline,
    background: pd.DataFrame,
    feature_categories: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Explain one row with cached LinearExplainer on the pipeline's logistic step."""
    patient = _as_single_row(row)
    expected = list(model.feature_names_in_)
    missing = [name for name in expected if name not in patient.columns]
    unexpected = [name for name in patient.columns if name not in expected]
    if missing or unexpected:
        raise ValueError(f"Feature mismatch; missing={missing}, unexpected={unexpected}")
    patient = patient.loc[:, expected]
    reference = background.loc[:, expected]
    preprocessor = model.named_steps["preprocess"]
    classifier = model.named_steps["classifier"]
    transformed = preprocessor.transform(patient)
    transformed_background = preprocessor.transform(reference)
    if sparse.issparse(transformed):
        transformed = transformed.toarray()
    if sparse.issparse(transformed_background):
        transformed_background = transformed_background.toarray()
    transformed = np.asarray(transformed, dtype="float64")
    transformed_background = np.asarray(transformed_background, dtype="float64")
    origins = _feature_origins(preprocessor)
    values = patient.iloc[0].to_dict()
    shap_result = compute_shap_attributions(
        classifier, transformed, transformed_background, origins,
        feature_values=values, feature_categories=feature_categories,
    )
    exact_base, exact_values = exact_centered_attributions(
        classifier, transformed, transformed_background, origins
    )
    shap_values = {item["feature"]: item["shap_value"] for item in shap_result["feature_contributions"]}
    try:
        verify_attribution_consistency(
            classifier, transformed, shap_result["base_value"], shap_values, exact_values
        )
        if not np.isclose(shap_result["base_value"], exact_base, atol=1e-6, rtol=0):
            raise AssertionError(f"SHAP base value {shap_result['base_value']} differs from exact base {exact_base}")
    except AssertionError as exc:
        LOGGER.warning("SHAP attribution consistency check failed for %s: %s", target.upper(), exc)

    log_odds = float(classifier.decision_function(transformed)[0])
    probability = float(model.predict_proba(patient)[0, 1])
    return {
        "target": target.upper(),
        "positive_probability": probability,
        "model_log_odds": log_odds,
        "base_value": shap_result["base_value"],
        "contribution_sum_log_odds": float(sum(shap_values.values())),
        "explanation_method": "SHAP LinearExplainer interventional values in log-odds space",
        "feature_contributions": [
            {
                "feature": item["feature"],
                "category": item["category"],
                "input_value": item["input_value"],
                "log_odds_contribution": item["shap_value"],
                "direction": item["direction"],
            }
            for item in shap_result["feature_contributions"]
        ],
    }


def load_explanation_model(target: str, model_dir: str | Path = MODEL_DIR) -> Pipeline:
    """Load the raw logistic pipeline for a target (not its calibrated variant)."""
    normalized = target.upper()
    if normalized not in TARGETS:
        raise KeyError(f"Unknown target {target!r}; expected one of {sorted(TARGETS)}")
    model_path = Path(model_dir) / f"{normalized.lower()}_logistic.joblib"
    if not model_path.is_file():
        raise FileNotFoundError(f"Model artifact not found: {model_path}")
    model = joblib.load(model_path)
    if not isinstance(model, Pipeline) or "preprocess" not in model.named_steps or "classifier" not in model.named_steps:
        raise TypeError("Expected a saved preprocessing + classifier sklearn Pipeline")
    if not hasattr(model.named_steps["classifier"], "coef_"):
        raise TypeError("Exact log-odds explanations are implemented for linear classifiers only")
    return model


def _as_single_row(row: Mapping[str, Any] | pd.DataFrame) -> pd.DataFrame:
    if isinstance(row, pd.DataFrame):
        if len(row) != 1:
            raise ValueError("explain_one expects exactly one patient row")
        result = row.copy()
    elif isinstance(row, Mapping):
        result = pd.DataFrame([dict(row)])
    else:
        raise TypeError("row must be a mapping of feature names to values or a one-row DataFrame")
    result = canonicalize_features(result)
    # Safety boundary: remove every observed target if a caller passed a raw row.
    result = result.drop(columns=[name for name in OUTCOME_COLUMNS if name in result.columns])
    return result


def _feature_origins(preprocessor: Any) -> list[str]:
    """Map each transformed output column back to its original input feature."""
    origins: list[str] = []
    for transformer_name, transformer, columns in preprocessor.transformers_:
        if transformer_name == "remainder" or isinstance(transformer, str):
            continue
        input_columns = [str(column) for column in columns]
        if transformer_name == "numeric":
            output_names = transformer.get_feature_names_out(input_columns)
            for output_name in output_names:
                output_name = str(output_name)
                prefix = "missingindicator_"
                origins.append(output_name[len(prefix):] if output_name.startswith(prefix) else output_name)
        elif transformer_name == "categorical":
            encoder = transformer.named_steps["onehot"]
            for column, categories in zip(input_columns, encoder.categories_):
                drop_indices = getattr(encoder, "drop_idx_", None)
                dropped = 0 if drop_indices is None or drop_indices[input_columns.index(column)] is None else 1
                origins.extend([column] * (len(categories) - dropped))
        else:
            raise ValueError(f"Unrecognized preprocessing block {transformer_name!r}")
    return origins


def explain_one(
    target: str,
    row: Mapping[str, Any] | pd.DataFrame,
    *,
    model: Pipeline | None = None,
    model_dir: str | Path = MODEL_DIR,
    top_k: int | None = None,
) -> dict[str, Any]:
    """Explain one prediction as exact original-feature contributions to log-odds.

    Contributions sum to `model_log_odds - intercept`. Positive values push
    toward the target's positive class; negative values push away from it.
    """
    normalized_target = target.upper()
    if normalized_target not in TARGETS:
        raise KeyError(f"Unknown target {target!r}; expected one of {sorted(TARGETS)}")
    fitted_model = model or load_explanation_model(normalized_target, model_dir)
    patient = _as_single_row(row)
    expected = list(fitted_model.feature_names_in_)
    missing = [name for name in expected if name not in patient.columns]
    unexpected = [name for name in patient.columns if name not in expected]
    if missing or unexpected:
        raise ValueError(f"Feature mismatch; missing={missing}, unexpected={unexpected}")
    patient = patient.loc[:, expected]

    preprocessor = fitted_model.named_steps["preprocess"]
    classifier = fitted_model.named_steps["classifier"]
    transformed = preprocessor.transform(patient)
    if sparse.issparse(transformed):
        transformed = transformed.toarray()
    transformed = np.asarray(transformed, dtype="float64")[0]
    coefficients = np.asarray(classifier.coef_, dtype="float64")[0]
    origins = _feature_origins(preprocessor)
    if not (len(origins) == len(transformed) == len(coefficients)):
        raise RuntimeError(
            "Could not map transformed model columns to source features: "
            f"origins={len(origins)}, transformed={len(transformed)}, coefficients={len(coefficients)}"
        )

    contributions: dict[str, float] = {name: 0.0 for name in expected}
    for source_feature, transformed_value, coefficient in zip(origins, transformed, coefficients):
        contributions[source_feature] += float(transformed_value * coefficient)
    intercept = float(np.asarray(classifier.intercept_).ravel()[0])
    log_odds = float(classifier.decision_function(preprocessor.transform(patient))[0])
    probability = float(fitted_model.predict_proba(patient)[0, 1])

    ordered = sorted(contributions.items(), key=lambda item: abs(item[1]), reverse=True)
    if top_k is not None:
        if top_k < 1:
            raise ValueError("top_k must be positive or None")
        ordered = ordered[:top_k]

    feature_values = patient.iloc[0].to_dict()
    explanation = [
        {
            "feature": name,
            "input_value": value.item() if isinstance(value, np.generic) else value,
            "log_odds_contribution": contribution,
            "direction": "toward_positive" if contribution > 0 else "away_from_positive" if contribution < 0 else "neutral",
        }
        for name, contribution in ordered
        for value in [feature_values[name]]
    ]
    return {
        "target": normalized_target,
        "positive_probability": probability,
        "model_log_odds": log_odds,
        "intercept_log_odds": intercept,
        "contribution_sum_log_odds": float(sum(contributions.values())),
        "explanation_method": "Exact additive coefficient contributions in the fitted logistic model's log-odds space",
        "interpretation_warning": "Model contributions describe this model's calculation; they are not causal effects or medical advice.",
        "feature_contributions": explanation,
    }


def summarize_global_contributions(
    rows: pd.DataFrame,
    *,
    model: Pipeline,
) -> list[dict[str, Any]]:
    """Rank mean absolute grouped log-odds contributions over supplied rows."""
    frame = _as_single_row(rows.iloc[[0]]) if len(rows) == 1 else canonicalize_features(rows.copy())
    frame = frame.drop(columns=[name for name in OUTCOME_COLUMNS if name in frame.columns])
    expected = list(model.feature_names_in_)
    missing = [name for name in expected if name not in frame.columns]
    unexpected = [name for name in frame.columns if name not in expected]
    if missing or unexpected:
        raise ValueError(f"Feature mismatch; missing={missing}, unexpected={unexpected}")
    frame = frame.loc[:, expected]

    preprocessor = model.named_steps["preprocess"]
    classifier = model.named_steps["classifier"]
    transformed = preprocessor.transform(frame)
    if sparse.issparse(transformed):
        transformed = transformed.toarray()
    transformed = np.asarray(transformed, dtype="float64")
    coefficients = np.asarray(classifier.coef_, dtype="float64")[0]
    origins = _feature_origins(preprocessor)
    if transformed.shape[1] != len(origins) or transformed.shape[1] != len(coefficients):
        raise RuntimeError("Could not map transformed columns to source features")

    grouped = np.zeros((len(frame), len(expected)), dtype="float64")
    source_indices = {name: index for index, name in enumerate(expected)}
    for output_index, source_feature in enumerate(origins):
        grouped[:, source_indices[source_feature]] += transformed[:, output_index] * coefficients[output_index]

    importance = np.mean(np.abs(grouped), axis=0)
    return [
        {
            "feature": expected[index],
            "mean_absolute_log_odds_contribution": float(importance[index]),
            "rows_summarized": int(len(frame)),
        }
        for index in np.argsort(importance)[::-1]
    ]
