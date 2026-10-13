"""Adapt M1's exact logistic explanations to the public API contract."""

from __future__ import annotations

import logging
from typing import Any, Mapping

import numpy as np
import pandas as pd

from ml.explain import explain_one, explain_shap_one, load_training_background


GROUPS = ("Demographic", "Symptoms and examination", "ECG", "Laboratory and echo")
LOGGER = logging.getLogger(__name__)


def _json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not np.isfinite(value):
        return None
    return value


class ExplanationService:
    """Use preloaded models when calling ``ml.explain.explain_one``."""

    def __init__(self, models: Mapping[str, Any], feature_config: Mapping[str, Any]):
        self.models = dict(models)
        self.groups = {
            str(feature["name"]): str(feature.get("group", ""))
            for feature in feature_config["features"]
        }

    def explain_target(self, target: str, frame: pd.DataFrame, top_k: int | None = 8) -> tuple[list[dict[str, Any]], dict[str, float]]:
        method = "shap.LinearExplainer"
        try:
            raw = explain_shap_one(
                target,
                frame,
                model=self.models[target],
                background=load_training_background(target),
                feature_categories=self.groups,
            )
            base_value = float(raw["base_value"])
        except Exception:
            LOGGER.exception("SHAP explanation failed for %s; falling back to exact linear decomposition", target)
            raw = explain_one(target, frame, model=self.models[target], top_k=None)
            method = "exact_linear_decomposition"
            base_value = float(raw["intercept_log_odds"])
        grouped = {group: 0.0 for group in GROUPS}
        items: list[dict[str, Any]] = []
        for contribution in raw["feature_contributions"]:
            feature = str(contribution["feature"])
            log_odds = float(contribution["log_odds_contribution"])
            group = str(contribution.get("category") or self.groups.get(feature, ""))
            if group in grouped:
                grouped[group] += log_odds
            if log_odds > 0:
                direction = "raises_risk"
            elif log_odds < 0:
                direction = "lowers_risk"
            else:
                direction = "neutral"
            items.append(
                {
                    "feature": feature,
                    "category": group,
                    "value": _json_value(contribution.get("input_value")),
                    "log_odds": log_odds,
                    "direction": direction,
                    "method": method,
                    "base_value": base_value,
                }
            )
        items.sort(key=lambda item: abs(item["log_odds"]), reverse=True)
        return (items if top_k is None else items[:top_k]), grouped

    def explain_all(self, frame: pd.DataFrame) -> tuple[dict[str, list[dict[str, Any]]], dict[str, dict[str, float]]]:
        explanations: dict[str, list[dict[str, Any]]] = {}
        group_contributions: dict[str, dict[str, float]] = {}
        for target in ("CAD", "LAD", "LCX", "RCA"):
            # Return all original-feature contributions so category totals are
            # exactly the sums of the feature contributions visible in JSON.
            items, groups = self.explain_target(target, frame, top_k=None)
            explanations[target] = items
            group_contributions[target] = groups
        return explanations, group_contributions
