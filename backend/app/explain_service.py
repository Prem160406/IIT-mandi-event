"""Adapt M1's exact logistic explanations to the public API contract."""

from __future__ import annotations

from typing import Any, Mapping

import numpy as np
import pandas as pd

from ml.explain import explain_one


GROUPS = ("Demographic", "Symptoms and examination", "ECG", "Laboratory and echo")


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

    def explain_target(self, target: str, frame: pd.DataFrame, top_k: int = 8) -> tuple[list[dict[str, Any]], dict[str, float]]:
        raw = explain_one(target, frame, model=self.models[target], top_k=None)
        grouped = {group: 0.0 for group in GROUPS}
        items: list[dict[str, Any]] = []
        for contribution in raw["feature_contributions"]:
            feature = str(contribution["feature"])
            log_odds = float(contribution["log_odds_contribution"])
            group = self.groups.get(feature)
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
                    "value": _json_value(contribution.get("input_value")),
                    "log_odds": log_odds,
                    "direction": direction,
                }
            )
        items.sort(key=lambda item: abs(item["log_odds"]), reverse=True)
        return items[:top_k], grouped

    def explain_all(self, frame: pd.DataFrame) -> tuple[dict[str, list[dict[str, Any]]], dict[str, dict[str, float]]]:
        explanations: dict[str, list[dict[str, Any]]] = {}
        group_contributions: dict[str, dict[str, float]] = {}
        for target in ("CAD", "LAD", "LCX", "RCA"):
            items, groups = self.explain_target(target, frame)
            explanations[target] = items
            group_contributions[target] = groups
        return explanations, group_contributions
