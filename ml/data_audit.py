"""Create a reproducible, non-patient-identifying audit summary of the raw workbook."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd

from ml.data_prep import DEFAULT_DATA_PATH, ROOT, load_dataset, label_consistency


def _value_counts(series: pd.Series) -> dict[str, int]:
    return {str(key): int(value) for key, value in series.value_counts(dropna=False).items()}


def build_audit(path: str | Path = DEFAULT_DATA_PATH) -> dict[str, Any]:
    path = Path(path)
    frame = load_dataset(path)
    workbook = pd.ExcelFile(path)
    sheet_summaries = []
    for sheet_name in workbook.sheet_names:
        sheet = pd.read_excel(path, sheet_name=sheet_name)
        sheet_summaries.append({"sheet": sheet_name, "rows": int(len(sheet)), "columns": int(len(sheet.columns))})

    excluded = {"LAD", "LCX", "RCA", "Cath", "CAD"}
    predictors = frame.drop(columns=[name for name in excluded if name in frame.columns])
    constant_predictors = [name for name in predictors.columns if predictors[name].nunique(dropna=False) <= 1]
    object_columns = [
        name
        for name in predictors.columns
        if pd.api.types.is_object_dtype(predictors[name].dtype)
        or pd.api.types.is_string_dtype(predictors[name].dtype)
    ]
    categorical_values = {
        name: sorted(str(value).strip() for value in frame[name].dropna().unique())
        for name in object_columns
    }

    targets = {name: _value_counts(frame[name]) for name in ["Cath", "LAD", "LCX", "RCA"]}
    mismatch = label_consistency(frame)
    source_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    return {
        "source": {
            "file": path.relative_to(ROOT).as_posix(),
            "sha256": source_sha256,
            "selected_sheet": next(
                summary["sheet"]
                for summary in sheet_summaries
                if summary["rows"] == len(frame) and summary["columns"] == len(frame.columns)
            ),
        },
        "workbook_sheets": sheet_summaries,
        "rows": int(len(frame)),
        "columns": int(len(frame.columns)),
        "predictor_count_before_constant_review": int(len(predictors.columns)),
        "missing_values_by_column": {name: int(count) for name, count in frame.isna().sum().items()},
        "duplicate_rows": int(frame.duplicated().sum()),
        "outcome_counts": targets,
        "cath_vessel_consistency": mismatch,
        "constant_predictor_columns": constant_predictors,
        "categorical_values": categorical_values,
        "observations": [
            "No CAD column is present in the non-empty workbook sheet; Cath is the explicit CAD/Normal outcome.",
            "Sex contains the source spelling Fmale; data_prep maps it to Female without changing the raw workbook.",
            "Exertional CP is constant (N) in all 303 records and cannot provide learned signal in this file.",
            "Units and clinical reference ranges still require source verification; observed sample minima/maxima are not input limits.",
        ],
    }


def main() -> None:
    output_path = ROOT / "reports" / "data_audit.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report = build_audit()
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {output_path.relative_to(ROOT)}")
    print(f"Rows: {report['rows']}; columns: {report['columns']}; duplicate rows: {report['duplicate_rows']}")
    print(f"Cath/vessel consistency mismatches: {report['cath_vessel_consistency']['mismatch_count']}")
    print(f"Constant predictors: {report['constant_predictor_columns']}")


if __name__ == "__main__":
    main()
