"""End-to-end checks for the M2 API and leakage boundary."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app


ROOT = Path(__file__).resolve().parents[2]
EXPECTED_DISCLAIMER = "For decision support and educational purposes only. Not a substitute for formal diagnostic imaging."


def test_health_and_features_endpoints() -> None:
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json() == {"status": "ok", "loaded_models": ["CAD", "LAD", "LCX", "RCA"]}

        feature_response = client.get("/features")
        assert feature_response.status_code == 200
        features = feature_response.json()["features"]
        assert len(features) == 55
        assert {item["name"] for item in features}.isdisjoint({"CAD", "LAD", "LCX", "RCA", "Cath"})


def test_artery_config_matches_predict_response() -> None:
    arteries = json.loads((ROOT / "config" / "arteries.json").read_text(encoding="utf-8"))["arteries"]
    expected = [entry["key"] for entry in arteries]
    with TestClient(app) as client:
        response = client.post("/predict", json={"features": {"Age": 50, "Sex": "Female"}})
    assert response.status_code == 200
    assert list(response.json()["vessels"]) == expected


def test_leakage_columns_cannot_change_inference() -> None:
    base = {"Age": 50, "Sex": "Female", "BP": 130, "Typical Chest Pain": 0}
    leaked = {**base, "CAD": "Normal", "Cath": "Normal", "LAD": "Stenotic", "LCX": "Stenotic", "RCA": "Stenotic"}
    with TestClient(app) as client:
        clean_response = client.post("/predict", json={"features": base})
        leaked_response = client.post("/predict", json={"features": leaked})
    assert clean_response.status_code == leaked_response.status_code == 200
    clean = clean_response.json()
    leaked_result = leaked_response.json()
    assert clean["cad"] == leaked_result["cad"]
    assert clean["vessels"] == leaked_result["vessels"]
    assert all(item["value"] not in {"Normal", "Stenotic"} for values in leaked_result["explanations"].values() for item in values)


def test_predict_accepts_full_and_partial_inputs() -> None:
    with TestClient(app) as client:
        sample = client.get("/samples").json()["samples"][1]["features"]
        full_response = client.post("/predict", json={"features": sample})
        partial_response = client.post("/predict", json={"features": {"Age": 60}})

    assert full_response.status_code == partial_response.status_code == 200
    full = full_response.json()
    partial = partial_response.json()
    assert full["missing_fields"] == []
    assert partial["missing_fields"]
    for result in (full, partial):
        assert set(result["explanations"]) == {"CAD", "LAD", "LCX", "RCA"}
        assert result["disclaimer"] == EXPECTED_DISCLAIMER
        assert all(0.0 <= vessel["probability"] <= 1.0 for vessel in result["vessels"].values())
