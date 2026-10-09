"""ETL the processed 14-column UCI Heart Disease source files from the ZIP.

This creates a cohort-tagged CAD dataset for schema review and source-aware
experiments. It does not merge rows into the organizer dataset or train a model.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARCHIVE = ROOT / "data" / "raw" / "uci_heart_disease_45.zip"
DEFAULT_OUTPUT = ROOT / "data" / "interim" / "uci_heart_disease_45.csv"
DEFAULT_AUDIT = ROOT / "reports" / "uci_heart_disease_45_audit.json"

FEATURE_COLUMNS = (
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach",
    "exang", "oldpeak", "slope", "ca", "thal",
)
TARGET_COLUMN = "num"
ALL_COLUMNS = (*FEATURE_COLUMNS, TARGET_COLUMN)
PROCESSED_FILES = {
    "cleveland": "processed.cleveland.data",
    "hungary": "processed.hungarian.data",
    "switzerland": "processed.switzerland.data",
    "long_beach_va": "processed.va.data",
}
MISSING_TOKENS = {"", "?", "-9", "-9.0"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_value(token: str, column: str) -> float | int | None:
    cleaned = token.strip()
    if cleaned in MISSING_TOKENS:
        return None
    try:
        value = float(cleaned)
    except ValueError as exc:
        raise ValueError(f"Non-numeric value {token!r} in {column!r}") from exc
    if column == TARGET_COLUMN:
        if not value.is_integer() or int(value) not in range(5):
            raise ValueError(f"Unexpected {TARGET_COLUMN} label: {token!r}")
        return int(value)
    return value


def load_rows(archive_path: Path) -> tuple[list[dict[str, object]], dict[str, object]]:
    rows: list[dict[str, object]] = []
    cohort_audit: dict[str, object] = {}
    with ZipFile(archive_path) as archive:
        available = set(archive.namelist())
        for cohort, filename in PROCESSED_FILES.items():
            if filename not in available:
                raise FileNotFoundError(f"Expected {filename!r} in {archive_path}")
            text = archive.read(filename).decode("utf-8-sig", errors="strict")
            reader = csv.reader(text.splitlines())
            cohort_rows: list[dict[str, object]] = []
            for row_number, tokens in enumerate(reader, start=1):
                if len(tokens) != len(ALL_COLUMNS):
                    raise ValueError(
                        f"{filename}:{row_number} has {len(tokens)} columns; expected {len(ALL_COLUMNS)}"
                    )
                parsed = {
                    column: parse_value(token, column)
                    for column, token in zip(ALL_COLUMNS, tokens)
                }
                target = parsed[TARGET_COLUMN]
                if target is None:
                    raise ValueError(f"Missing target at {filename}:{row_number}")
                parsed["cad"] = int(target > 0)
                parsed["source_cohort"] = cohort
                parsed["source_row"] = row_number
                parsed["source_file"] = filename
                cohort_rows.append(parsed)
            rows.extend(cohort_rows)
            labels = Counter(str(row[TARGET_COLUMN]) for row in cohort_rows)
            cohort_audit[cohort] = {
                "source_file": filename,
                "rows": len(cohort_rows),
                "num_label_counts": dict(sorted(labels.items())),
                "cad_positive": sum(int(row["cad"]) for row in cohort_rows),
                "cad_negative": sum(1 - int(row["cad"]) for row in cohort_rows),
                "missing_feature_values": {
                    column: sum(row[column] is None for row in cohort_rows)
                    for column in FEATURE_COLUMNS
                },
            }
    return rows, cohort_audit


def write_outputs(
    archive_path: Path = DEFAULT_ARCHIVE,
    output_path: Path = DEFAULT_OUTPUT,
    audit_path: Path = DEFAULT_AUDIT,
) -> dict[str, object]:
    if not archive_path.is_file():
        raise FileNotFoundError(f"UCI archive not found: {archive_path}")
    rows, cohorts = load_rows(archive_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [*ALL_COLUMNS, "cad", "source_cohort", "source_row", "source_file"]
    with output_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    audit = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_archive": archive_path.name,
        "source_archive_sha256": sha256(archive_path),
        "source_page": "https://archive.ics.uci.edu/dataset/45/heart+disease",
        "target_mapping": "CAD=0 when num=0; CAD=1 when num is 1, 2, 3, or 4.",
        "target_column_is_not_a_predictor": True,
        "feature_columns": list(FEATURE_COLUMNS),
        "processed_source_files": list(PROCESSED_FILES.values()),
        "total_rows": len(rows),
        "total_cad_positive": sum(int(row["cad"]) for row in rows),
        "total_cad_negative": sum(1 - int(row["cad"]) for row in rows),
        "total_missing_feature_values": sum(
            int(details["missing_feature_values"][column])
            for details in cohorts.values()
            for column in FEATURE_COLUMNS
        ),
        "cohorts": cohorts,
        "interpretation": (
            "Cohort-tagged CAD-only ETL output for schema and source-aware evaluation. "
            "No row-level merge, feature harmonization with dataset 411, split, or model training is performed."
        ),
    }
    audit_path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return audit


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--audit", type=Path, default=DEFAULT_AUDIT)
    args = parser.parse_args()
    audit = write_outputs(args.archive, args.output, args.audit)
    print(
        f"ETL saved {audit['total_rows']} cohort-tagged rows to {args.output}; "
        f"audit saved to {args.audit}"
    )


if __name__ == "__main__":
    main()
