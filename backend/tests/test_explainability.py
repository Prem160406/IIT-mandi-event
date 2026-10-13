"""SHAP/exact consistency and backwards-compatible explanation API tests."""

from __future__ import annotations

from collections import defaultdict

import numpy as np
from fastapi.testclient import TestClient
from scipy import sparse

from backend.app.main import app
from ml.explain import _feature_origins, exact_centered_attributions, load_training_background


def _dense(value):
    return value.toarray() if sparse.issparse(value) else np.asarray(value, dtype="float64")


def test_demo_cases_shap_additivity_exact_match_and_group_totals() -> None:
    with TestClient(app) as client:
        samples = client.get("/samples").json()["samples"]
        for sample in samples:
            response = client.post("/predict", json={"features": sample["features"]})
            assert response.status_code == 200
            payload = response.json()
            assert set(payload) == {
                "model_version", "missing_fields", "cad", "vessels", "explanations",
                "group_contributions", "disclaimer",
            }
            container = client.app.state.container
            prepared = container.predictor.prepare_input(sample["features"]).frame
            for target, entries in payload["explanations"].items():
                assert entries
                assert all(item["method"] == "shap.LinearExplainer" for item in entries)
                assert all("base_value" in item and "category" in item for item in entries)
                base_value = entries[0]["base_value"]
                model = container.predictor.models[target]
                assert np.isclose(
                    base_value + sum(item["log_odds"] for item in entries),
                    model.decision_function(prepared)[0], atol=1e-6, rtol=0,
                )

                x = _dense(model.named_steps["preprocess"].transform(prepared))
                reference = _dense(model.named_steps["preprocess"].transform(load_training_background(target)))
                origins = _feature_origins(model.named_steps["preprocess"])
                exact_base, exact = exact_centered_attributions(
                    model.named_steps["classifier"], x, reference, origins
                )
                shap_values = {item["feature"]: item["log_odds"] for item in entries}
                assert np.isclose(base_value, exact_base, atol=1e-6, rtol=0)
                assert shap_values.keys() == exact.keys()
                assert all(np.isclose(shap_values[name], exact[name], atol=1e-6, rtol=0) for name in exact)

                by_group: dict[str, float] = defaultdict(float)
                for item in entries:
                    by_group[item["category"]] += item["log_odds"]
                for group, total in payload["group_contributions"][target].items():
                    assert np.isclose(by_group[group], total, atol=1e-9, rtol=0)


def test_explanation_api_falls_back_when_shap_raises(monkeypatch) -> None:
    import ml.explain

    def fail(*args, **kwargs):
        raise RuntimeError("simulated SHAP failure")

    monkeypatch.setattr(ml.explain, "compute_shap_attributions", fail)
    with TestClient(app) as client:
        response = client.post("/predict", json={"features": {"Age": 50, "Sex": "Female"}})
    assert response.status_code == 200
    explanations = response.json()["explanations"]
    assert all(items and items[0]["method"] == "exact_linear_decomposition" for items in explanations.values())
    assert all("base_value" in items[0] for items in explanations.values())
