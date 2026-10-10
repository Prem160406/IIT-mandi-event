"""Startup-loaded inference for the four raw logistic pipelines."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

import joblib
import numpy as np
import pandas as pd

from ml.data_prep import OUTCOME_COLUMNS, canonicalize_features, drop_leakage_columns


ROOT = Path(__file__).resolve().parents[2]
MODEL_TARGETS = ("CAD", "LAD", "LCX", "RCA")
MODEL_VERSION = "baseline-raw-logistic-1.0.0"
DECISION_THRESHOLD = 0.5


@dataclass(frozen=True)
class PreparedInput:
    frame: pd.DataFrame
    missing_fields: list[str]


class Predictor:
    """Own the model objects and perform leakage-safe prediction.

    Instances are constructed during FastAPI lifespan startup.  Requests only
    reuse the in-memory pipelines; no artifact is opened during inference.
    """

    def __init__(self, models: Mapping[str, Any], arteries_config: Mapping[str, Any]):
        self.models = dict(models)
        self.arteries = list(arteries_config["arteries"])
        risk_levels = arteries_config["riskLevels"]
        self.low_cutoff = float(risk_levels["low"])
        self.high_cutoff = float(risk_levels["high"])
        if tuple(self.models) != MODEL_TARGETS:
            missing = sorted(set(MODEL_TARGETS) - set(self.models))
            raise ValueError(f"Expected models {MODEL_TARGETS}; missing {missing}")
        expected = tuple(str(name) for name in self.models["CAD"].feature_names_in_)
        if not expected:
            raise ValueError("Loaded model has no feature_names_in_ metadata")
        for target, model in self.models.items():
            model_features = tuple(str(name) for name in model.feature_names_in_)
            if model_features != expected:
                raise ValueError(f"Model {target} does not use the shared feature ordering")
        self.feature_names = expected

    @classmethod
    def from_artifacts(
        cls,
        arteries_config: Mapping[str, Any],
        model_dir: str | Path = ROOT / "artifacts" / "baseline",
    ) -> "Predictor":
        """Load each raw pipeline exactly once for the application lifetime."""
        directory = Path(model_dir)
        models: dict[str, Any] = {}
        for target in MODEL_TARGETS:
            path = directory / f"{target.lower()}_logistic.joblib"
            if not path.is_file():
                raise FileNotFoundError(f"Model artifact not found: {path}")
            models[target] = joblib.load(path)
        return cls(models, arteries_config)

    def prepare_input(self, features: Mapping[str, Any]) -> PreparedInput:
        """Build the exact training column set after removing outcomes.

        The pipelines contain their own numerical/categorical imputers.  A
        missing requested field is therefore represented by ``NaN`` while its
        name is retained for transparency in the API response.
        """
        raw = pd.DataFrame([dict(features)])
        raw = canonicalize_features(raw)
        supplied_names = set(raw.columns)
        raw = drop_leakage_columns(raw)
        if raw.empty:
            raw = pd.DataFrame([{}])
        missing_fields = [name for name in self.feature_names if name not in supplied_names]

        row: dict[str, Any] = {}
        for name in self.feature_names:
            value = raw.iloc[0][name] if name in raw.columns else np.nan
            row[name] = np.nan if value is None else value
        return PreparedInput(pd.DataFrame([row], columns=self.feature_names), missing_fields)

    def risk_level(self, probability: float) -> str:
        if probability < self.low_cutoff:
            return "low"
        if probability <= self.high_cutoff:
            return "moderate"
        return "high"

    def predict(self, features: Mapping[str, Any]) -> tuple[dict[str, Any], PreparedInput]:
        prepared = self.prepare_input(features)
        probabilities: dict[str, float] = {}
        for target, model in self.models.items():
            probability = float(model.predict_proba(prepared.frame)[0, 1])
            probabilities[target] = float(np.clip(probability, 0.0, 1.0))

        cad_probability = probabilities["CAD"]
        result: dict[str, Any] = {
            "model_version": MODEL_VERSION,
            "missing_fields": prepared.missing_fields,
            "cad": {
                "probability": cad_probability,
                "label": "CAD likely" if cad_probability >= DECISION_THRESHOLD else "CAD unlikely",
                "threshold": DECISION_THRESHOLD,
                "risk_level": self.risk_level(cad_probability),
            },
            "vessels": {},
        }
        for artery in self.arteries:
            key = str(artery["key"])
            target = str(artery["target"])
            if target not in probabilities:
                raise ValueError(f"Artery target {target!r} has no loaded model")
            probability = probabilities[target]
            result["vessels"][key] = {
                "probability": probability,
                "risk_level": self.risk_level(probability),
                "threshold": DECISION_THRESHOLD,
            }
        return result, prepared


def leakage_columns() -> frozenset[str]:
    """Expose the single authoritative leakage set for tests and diagnostics."""
    return frozenset(OUTCOME_COLUMNS)
