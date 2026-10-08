"""Leakage-safe loading and target preparation for the UCI CAD workbook."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_PATH = ROOT / "data" / "raw" / "z_alizadeh_sani_uci_411.xlsx"
DEFAULT_TARGET_CONFIG = ROOT / "config" / "targets.yaml"

# Treat every recorded outcome as unavailable at prediction time for every model.
OUTCOME_COLUMNS = frozenset({"CAD", "LAD", "LCX", "RCA", "Cath"})
REQUIRED_OUTCOME_COLUMNS = frozenset({"LAD", "LCX", "RCA", "Cath"})


def load_target_config(path: str | Path = DEFAULT_TARGET_CONFIG) -> dict[str, Any]:
    """Load target mappings from YAML; PyYAML is part of the project environment."""
    try:
        import yaml
    except ImportError as exc:  # pragma: no cover - environment setup path
        raise RuntimeError("Install the project requirements, including PyYAML, to load target config") from exc

    with Path(path).open("r", encoding="utf-8") as handle:
        config = yaml.safe_load(handle)
    if not isinstance(config, dict) or not isinstance(config.get("targets"), dict):
        raise ValueError(f"Invalid target config: {path}")
    return config


def load_dataset(path: str | Path = DEFAULT_DATA_PATH) -> pd.DataFrame:
    """Read the non-empty workbook sheet containing the expected outcomes."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Dataset not found: {path}")

    workbook = pd.ExcelFile(path)
    for sheet_name in workbook.sheet_names:
        frame = pd.read_excel(path, sheet_name=sheet_name)
        frame.columns = [str(name).strip() for name in frame.columns]
        if frame.empty or not REQUIRED_OUTCOME_COLUMNS.issubset(frame.columns):
            continue
        if frame.columns.duplicated().any():
            duplicates = frame.columns[frame.columns.duplicated()].tolist()
            raise ValueError(f"Duplicate column names after trimming whitespace: {duplicates}")
        return frame

    raise ValueError(
        "No non-empty sheet contains the required outcome columns: "
        + ", ".join(sorted(REQUIRED_OUTCOME_COLUMNS))
    )


def canonicalize_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Normalize harmless text inconsistencies without changing the raw workbook."""
    result = frame.copy()
    for column in result.columns:
        if pd.api.types.is_string_dtype(result[column].dtype) or pd.api.types.is_object_dtype(
            result[column].dtype
        ):
            result[column] = result[column].map(
                lambda value: value.strip() if isinstance(value, str) else value
            )

    # The source workbook uses this spelling for the female category.
    if "Sex" in result.columns:
        result["Sex"] = result["Sex"].replace({"Fmale": "Female", "female": "Female", "male": "Male"})

    if "VHD" in result.columns:
        result["VHD"] = result["VHD"].replace(
            {"mild": "Mild", "moderate": "Moderate", "severe": "Severe"}
        )
    return result


def drop_leakage_columns(frame: pd.DataFrame) -> pd.DataFrame:
    """Drop all known outcome columns from a predictor frame."""
    return frame.drop(columns=[name for name in OUTCOME_COLUMNS if name in frame.columns]).copy()


def build_xy(
    frame: pd.DataFrame,
    target: str,
    config: dict[str, Any] | None = None,
) -> tuple[pd.DataFrame, pd.Series]:
    """Return predictors and a binary target, with all outcomes removed from X."""
    if config is None:
        config = load_target_config()
    if target not in config["targets"]:
        raise KeyError(f"Unknown target {target!r}; expected one of {sorted(config['targets'])}")

    target_spec = config["targets"][target]
    source_column = target_spec["source_column"]
    if source_column not in frame.columns:
        raise KeyError(f"Target {target!r} source column {source_column!r} is missing")

    raw_y = frame[source_column].astype("string").str.strip().str.casefold()
    positive_values = {str(value).strip().casefold() for value in target_spec["positive_values"]}
    negative_values = {str(value).strip().casefold() for value in target_spec["negative_values"]}
    label_map = {**{value: 1 for value in positive_values}, **{value: 0 for value in negative_values}}
    y = raw_y.map(label_map)
    if y.isna().any():
        unknown = sorted(raw_y[y.isna()].dropna().unique().tolist())
        raise ValueError(f"Unexpected labels in {source_column!r} for {target}: {unknown}")
    y = y.astype("int8").rename(target)

    X = canonicalize_features(frame)
    X = drop_leakage_columns(X)
    remaining = OUTCOME_COLUMNS.intersection(X.columns)
    if remaining:
        raise AssertionError(f"Outcome leakage columns remain in predictors: {sorted(remaining)}")
    if len(X) != len(y):
        raise AssertionError("Predictor and target row counts do not match")
    return X, y


def label_consistency(frame: pd.DataFrame) -> dict[str, Any]:
    """Compare Cath's CAD/Normal label with the source's any-vessel rule."""
    cath_is_cad = frame["Cath"].astype("string").str.strip().str.casefold().eq("cad")
    any_vessel_stenotic = frame[["LAD", "LCX", "RCA"]].apply(
        lambda column: column.astype("string").str.strip().str.casefold().eq("stenotic")
    ).any(axis=1)
    mismatch_indices = frame.index[cath_is_cad.ne(any_vessel_stenotic)].tolist()
    return {
        "rule": "Cath is CAD when any of LAD, LCX, or RCA is Stenotic",
        "mismatch_count": len(mismatch_indices),
        "zero_based_row_indices": mismatch_indices,
        "excel_row_numbers": [index + 2 for index in mismatch_indices],
    }
