"""Faithful local explanations for the saved logistic-regression pipelines.

Each feature contribution is an exact additive term in the classifier's
log-odds after the fitted preprocessing transform. It describes model behavior,
not causation or a medical mechanism.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

import joblib
import numpy as np
import pandas as pd
from scipy.special import expit
from scipy import sparse
from sklearn.pipeline import Pipeline

from ml.data_prep import OUTCOME_COLUMNS, canonicalize_features


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "artifacts" / "baseline"
TARGETS = {"CAD", "LAD", "LCX", "RCA"}


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
