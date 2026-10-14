"""T3: one artery mapping must hold across the API, the config and the 3D model.

Checks that every artery in config/arteries.json has (a) a trained target, (b) a
key in the /predict response and (c) a node with the same name in the supplied
perfusion model loaded by the frontend.
"""

from __future__ import annotations

import json
import struct
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

ROOT = Path(__file__).resolve().parents[2]
GLB = ROOT / "frontend" / "public" / "models" / "Heart2_Perfusion_Map.glb"


def _glb_node_names(path: Path) -> set[str]:
    data = path.read_bytes()
    magic, _version, _length = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF", "perfusion model is not a binary glTF file"
    chunk_length, chunk_type = struct.unpack_from("<I4s", data, 12)
    assert chunk_type == b"JSON"
    gltf = json.loads(data[20 : 20 + chunk_length])
    return {node["name"] for node in gltf.get("nodes", []) if "name" in node}


@pytest.fixture(scope="module")
def arteries() -> list[dict]:
    return json.loads((ROOT / "config" / "arteries.json").read_text(encoding="utf-8"))["arteries"]


def test_every_artery_has_a_mesh_node_in_the_glb(arteries):
    if not GLB.is_file():
        pytest.skip("frontend/public/models/Heart2_Perfusion_Map.glb not present")
    names = _glb_node_names(GLB)
    missing = [a["meshNode"] for a in arteries if a["meshNode"] not in names]
    assert not missing, f"perfusion model has no node named {missing}"


def test_every_artery_is_in_the_predict_response(arteries):
    with TestClient(app) as client:
        sample = client.get("/samples").json()["samples"][0]["features"]
        body = client.post("/predict", json={"features": sample}).json()
    assert {a["key"] for a in arteries} <= set(body["vessels"]), "API response is missing an artery key"
    assert {a["key"] for a in arteries} <= set(body["explanations"]), "API explanations are missing an artery key"
