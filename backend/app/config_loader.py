"""Load and validate the backend's file-based configuration.

The backend intentionally keeps configuration in the repository's shared
``config`` directory.  Paths are resolved from this module rather than from
the process working directory, so the API behaves the same on Windows,
Linux, Uvicorn reloads, and test runners.
"""

from __future__ import annotations

from functools import lru_cache
import json
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "config"
REPORTS_DIR = ROOT / "reports"


def _resolve(path: str | Path | None, default: Path) -> Path:
    candidate = default if path is None else Path(path)
    candidate = candidate if candidate.is_absolute() else ROOT / candidate
    if not candidate.is_file():
        raise FileNotFoundError(f"Configuration file not found: {candidate}")
    return candidate


def _require_mapping(value: Any, path: Path) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"Expected a mapping in {path}")
    return value


@lru_cache(maxsize=None)
def load_features_config(path: str | Path | None = None) -> dict[str, Any]:
    """Return the parsed and minimally validated feature configuration."""
    resolved = _resolve(path, CONFIG_DIR / "features.yaml")
    with resolved.open("r", encoding="utf-8") as handle:
        config = _require_mapping(yaml.safe_load(handle), resolved)
    features = config.get("features")
    if not isinstance(features, list) or not all(isinstance(item, dict) for item in features):
        raise ValueError(f"{resolved} must contain a list of feature mappings")
    names = [item.get("name") for item in features]
    if any(not isinstance(name, str) or not name.strip() for name in names):
        raise ValueError(f"Every feature in {resolved} must have a non-empty name")
    if len(names) != len(set(names)):
        raise ValueError(f"Feature names must be unique in {resolved}")
    return config


@lru_cache(maxsize=None)
def load_targets_config(path: str | Path | None = None) -> dict[str, Any]:
    """Return the parsed target and leakage configuration."""
    resolved = _resolve(path, CONFIG_DIR / "targets.yaml")
    with resolved.open("r", encoding="utf-8") as handle:
        config = _require_mapping(yaml.safe_load(handle), resolved)
    targets = config.get("targets")
    excluded = config.get("excluded_input_columns")
    if not isinstance(targets, dict) or not targets:
        raise ValueError(f"{resolved} must contain a non-empty targets mapping")
    if not isinstance(excluded, list) or not all(isinstance(item, str) for item in excluded):
        raise ValueError(f"{resolved} must contain excluded_input_columns as a list of strings")
    return config


@lru_cache(maxsize=None)
def load_arteries_config(path: str | Path | None = None) -> dict[str, Any]:
    """Return the shared 3D/backend artery contract."""
    resolved = _resolve(path, CONFIG_DIR / "arteries.json")
    with resolved.open("r", encoding="utf-8") as handle:
        config = _require_mapping(json.load(handle), resolved)
    arteries = config.get("arteries")
    risk_levels = config.get("riskLevels")
    if not isinstance(arteries, list) or not arteries:
        raise ValueError(f"{resolved} must contain a non-empty arteries list")
    if not all(isinstance(item, dict) for item in arteries):
        raise ValueError(f"Every artery in {resolved} must be an object")
    keys = [item.get("key") for item in arteries]
    required_fields = {"key", "label", "meshNode", "target"}
    if any(required_fields - item.keys() for item in arteries) or len(keys) != len(set(keys)):
        raise ValueError(f"Artery entries in {resolved} must have unique complete keys")
    if not isinstance(risk_levels, dict) or not {"low", "high"}.issubset(risk_levels):
        raise ValueError(f"{resolved} must define low and high risk cutoffs")
    low, high = float(risk_levels["low"]), float(risk_levels["high"])
    if not 0.0 <= low < high <= 1.0:
        raise ValueError(f"Risk cutoffs in {resolved} must satisfy 0 <= low < high <= 1")
    return config


@lru_cache(maxsize=None)
def load_metrics(path: str | Path | None = None) -> dict[str, Any]:
    """Load the M1 evaluation report for the read-only ``/metrics`` endpoint."""
    resolved = _resolve(path, REPORTS_DIR / "metrics.json")
    with resolved.open("r", encoding="utf-8") as handle:
        return _require_mapping(json.load(handle), resolved)


def load_configs() -> dict[str, dict[str, Any]]:
    """Load all startup configuration through the caching helpers."""
    return {
        "features": load_features_config(),
        "targets": load_targets_config(),
        "arteries": load_arteries_config(),
    }


def clear_config_caches() -> None:
    """Clear cached files, primarily for isolated tests and local development."""
    load_features_config.cache_clear()
    load_targets_config.cache_clear()
    load_arteries_config.cache_clear()
    load_metrics.cache_clear()
