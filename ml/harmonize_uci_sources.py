"""Audit and evaluate cross-source UCI CAD feature harmonization.

The organizer Z-Alizadeh Sani extension and UCI Heart Disease (dataset 45)
are kept as separate domains. This script evaluates transfer without joining
rows or allowing a test source into training. It is an exploratory research
analysis, not an application model or clinical validation.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ml.data_prep import canonicalize_features, load_dataset


ROOT = Path(__file__).resolve().parents[1]
UCI_PATH = ROOT / "data" / "interim" / "uci_heart_disease_45.csv"
JSON_PATH = ROOT / "reports" / "cross_source_harmonization.json"
MD_PATH = ROOT / "reports" / "cross_source_harmonization.md"
SEED = 2026
VARIANTS: dict[str, list[str]] = {
    "core_age_sex_fbs": ["age", "sex", "fbs120"],
    "core_plus_bp": ["age", "sex", "fbs120", "bp"],
    "core_plus_chest_pain": ["age", "sex", "fbs120", "chest_pain"],
    "core_plus_chest_pain_assume_no_flags_asymptomatic": ["age", "sex", "fbs120", "chest_pain"],
    "expanded_bp_and_chest_pain": ["age", "sex", "fbs120", "bp", "chest_pain"],
}
CAT = {"sex", "chest_pain"}


def encode_primary(frame: pd.DataFrame, no_flags_asymptomatic: bool = False) -> pd.DataFrame:
    out = pd.DataFrame(index=frame.index)
    out["age"] = pd.to_numeric(frame["Age"], errors="coerce")
    out["sex"] = frame["Sex"].map({"Male": "male", "Female": "female"})
    out["fbs120"] = (pd.to_numeric(frame["FBS"], errors="coerce") > 120).astype(float)
    out.loc[pd.to_numeric(frame["FBS"], errors="coerce").isna(), "fbs120"] = np.nan
    out["bp"] = pd.to_numeric(frame["BP"], errors="coerce")

    typical = pd.to_numeric(frame["Typical Chest Pain"], errors="coerce").eq(1)
    atypical = frame["Atypical"].eq("Y")
    nonanginal = frame["Nonanginal"].eq("Y")
    flags = pd.DataFrame({"typical": typical, "atypical": atypical, "nonanginal": nonanginal})
    count = flags.sum(axis=1)
    if count.gt(1).any():
        raise ValueError("Chest-pain source flags overlap; do not force a one-category crosswalk")
    category = np.select(
        [typical, atypical, nonanginal],
        ["typical", "atypical", "nonanginal"],
        default="asymptomatic" if no_flags_asymptomatic else "no_category_flag",
    )
    out["chest_pain"] = category
    return out


def encode_uci(frame: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=frame.index)
    out["age"] = pd.to_numeric(frame["age"], errors="coerce")
    sex = pd.to_numeric(frame["sex"], errors="coerce")
    out["sex"] = sex.map({1: "male", 0: "female"})
    fbs = pd.to_numeric(frame["fbs"], errors="coerce")
    out["fbs120"] = fbs.where(fbs.isin([0, 1]))
    out["bp"] = pd.to_numeric(frame["trestbps"], errors="coerce")
    cp = pd.to_numeric(frame["cp"], errors="coerce")
    out["chest_pain"] = cp.map({1: "typical", 2: "atypical", 3: "nonanginal", 4: "asymptomatic"})
    return out


def make_model(features: list[str]) -> Pipeline:
    numeric = [c for c in features if c not in CAT]
    categorical = [c for c in features if c in CAT]
    transformers = []
    if numeric:
        transformers.append(("numeric", Pipeline([
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("scale", StandardScaler()),
        ]), numeric))
    if categorical:
        transformers.append(("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]), categorical))
    return Pipeline([
        ("preprocess", ColumnTransformer(transformers)),
        ("model", LogisticRegression(max_iter=3000, random_state=SEED)),
    ])


def score(y: np.ndarray, p: np.ndarray) -> dict[str, Any]:
    pred = (p >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    # Class-stratified bootstrap keeps observed prevalence fixed. These
    # intervals are conditional on the fitted model, not training variation.
    rng = np.random.default_rng(SEED + len(y) + int(y.sum()))
    pos = np.flatnonzero(y == 1)
    neg = np.flatnonzero(y == 0)
    replicates = 2000
    pos_p = rng.choice(p[pos], size=(replicates, len(pos)), replace=True)
    neg_p = rng.choice(p[neg], size=(replicates, len(neg)), replace=True)
    pairwise = pos_p[:, :, None] - neg_p[:, None, :]
    auc_samples = (pairwise > 0).mean(axis=(1, 2)) + 0.5 * (pairwise == 0).mean(axis=(1, 2))
    brier_samples = (
        (len(pos) / len(y)) * np.square(1 - pos_p).mean(axis=1)
        + (len(neg) / len(y)) * np.square(neg_p).mean(axis=1)
    )
    return {
        "n": int(len(y)), "positive": int(y.sum()), "negative": int(len(y) - y.sum()),
        "roc_auc": float(roc_auc_score(y, p)) if len(np.unique(y)) == 2 else None,
        "roc_auc_ci95_stratified_bootstrap": [float(x) for x in np.percentile(auc_samples, [2.5, 97.5])],
        "average_precision": float(average_precision_score(y, p)),
        "brier_score": float(brier_score_loss(y, p)),
        "brier_ci95_stratified_bootstrap": [float(x) for x in np.percentile(brier_samples, [2.5, 97.5])],
        "accuracy_at_0_5": float(accuracy_score(y, pred)),
        "precision_at_0_5": float(precision_score(y, pred, zero_division=0)),
        "sensitivity_at_0_5": float(recall_score(y, pred, zero_division=0)),
        "specificity_at_0_5": float(tn / (tn + fp)) if tn + fp else None,
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def evaluate_transfer(train_x: pd.DataFrame, train_y: np.ndarray, test_x: pd.DataFrame,
                      test_y: np.ndarray, features: list[str]) -> dict[str, Any]:
    model = make_model(features)
    model.fit(train_x[features], train_y)
    return score(test_y, model.predict_proba(test_x[features])[:, 1])


def run() -> dict[str, Any]:
    if not UCI_PATH.is_file():
        raise FileNotFoundError(f"Run ETL first: {UCI_PATH}")
    primary_raw = canonicalize_features(load_dataset())
    uci_raw = pd.read_csv(UCI_PATH)
    uci_x = encode_uci(uci_raw)
    primary_y = primary_raw["Cath"].eq("CAD").astype(int).to_numpy()
    primary_vessel_y = primary_raw[["LAD", "LCX", "RCA"]].eq("Stenotic").any(axis=1).astype(int).to_numpy()
    uci_y = uci_raw["cad"].astype(int).to_numpy()
    agreement = primary_y == primary_vessel_y

    results: dict[str, Any] = {}
    for variant_name, features in VARIANTS.items():
        assume_asymptomatic = "assume_no_flags_asymptomatic" in variant_name
        primary_x = encode_primary(primary_raw, no_flags_asymptomatic=assume_asymptomatic)
        zads_to_uci = {}
        for cohort in sorted(uci_raw["source_cohort"].unique()):
            mask = uci_raw["source_cohort"].eq(cohort).to_numpy()
            zads_to_uci[cohort] = evaluate_transfer(primary_x, primary_y, uci_x.loc[mask], uci_y[mask], features)
        uci_to_zads = evaluate_transfer(uci_x, uci_y, primary_x, primary_y, features)
        uci_to_zads["against_vessel_derived_sensitivity_label"] = score(primary_vessel_y, make_model(features).fit(uci_x[features], uci_y).predict_proba(primary_x[features])[:, 1])

        within_uci = {}
        for cohort in sorted(uci_raw["source_cohort"].unique()):
            mask = uci_raw["source_cohort"].eq(cohort).to_numpy()
            within_uci[cohort] = evaluate_transfer(uci_x.loc[~mask], uci_y[~mask], uci_x.loc[mask], uci_y[mask], features)
        results[variant_name] = {
            "features": features,
            "chest_pain_mapping": "No organizer category flags mapped to asymptomatic (explicit sensitivity assumption)." if assume_asymptomatic else "No organizer category flags retained as a separate no_category_flag value.",
            "organizer_to_each_uci_cohort": zads_to_uci,
            "all_uci_to_organizer": uci_to_zads,
            "uci_leave_one_cohort_out": within_uci,
        }

    audit = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "n_organizer": len(primary_raw), "n_uci45": len(uci_raw),
        "organizer_label_counts_cath": primary_raw["Cath"].value_counts().to_dict(),
        "organizer_cath_vs_any_stenotic_vessel": {
            "agreement_count": int(agreement.sum()), "mismatch_count": int((~agreement).sum()),
            "mismatch_rows_zero_based": np.flatnonzero(~agreement).tolist(),
        },
        "uci45_cohorts": {
            cohort: {"n": int((uci_raw.source_cohort == cohort).sum()),
                     "positive": int(uci_y[uci_raw.source_cohort.eq(cohort).to_numpy()].sum()),
                     "missing_fbs": int(uci_raw.loc[uci_raw.source_cohort.eq(cohort), "fbs"].isna().sum())}
            for cohort in sorted(uci_raw.source_cohort.unique())
        },
        "mapping_audit": {
            "age": "Direct: years in both datasets.",
            "sex": "Direct: normalized to male/female; UCI code 1=male, 0=female.",
            "fbs120": "Comparable threshold: organizer raw FBS mg/dL converted to >120; UCI fbs is already this indicator. UCI missing values remain missing and are imputed inside training folds.",
            "chest_pain": "Exploratory semantic mapping: organizer Typical/Atypical/Nonanginal flags map to UCI cp 1/2/3; the 30 organizer rows with no flags are either retained separately or assumed asymptomatic in an explicit sensitivity variant. UCI cp=4 is asymptomatic. Neither choice is proven from the field encoding alone.",
            "bp": "Exploratory mapping: organizer BP is documented as blood pressure in mmHg; UCI trestbps is resting/admission BP in mmHg. Primary source metadata does not explicitly label BP as systolic or specify measurement context, so BP is a sensitivity feature, not an exact-match core feature.",
            "target": "Organizer Cath CAD/Normal versus UCI num=0 versus num=1..4. UCI documentation describes <50% for 0 and >50% for positive, while organizer CAD is >=50%; the exact-50 boundary is not harmonized. Organizer Cath disagrees with the any-vessel rule in one row, reported separately.",
            "records": "No row-level patient identifiers are available for cross-source deduplication; datasets are treated as distinct source domains, not merged into one row table.",
        },
        "protocol": "Train only on one source and evaluate on the entirely external source or one untouched UCI cohort. Imputation, scaling, and category encoding are fitted within each training source. Fixed threshold 0.5 is descriptive only.",
        "models": "One regularized logistic regression per feature variant for interpretability and low sample-size control.",
        "results": results,
        "compatibility": "These source-harmonized experiments do not produce an app-ready model. The organizer application uses a 55-feature schema; this study tests only shared fields and keeps both datasets and models separate.",
        "limitations": [
            "Only two source families are available and both are historical, angiography-selected cohorts; transfer does not establish prospective clinical validity.",
            "The UCI 45 cohorts have pronounced label prevalence and missingness differences, including only eight CAD-negative Switzerland records.",
            "Chest-pain and blood-pressure mappings are explicit sensitivity assumptions; interpret the core and extensions separately.",
            "Performance at threshold 0.5 is not a recommended operating point; calibration and clinical utility need independent data and decision costs.",
            "Without patient identifiers, exact cross-source duplicate detection is not possible.",
        ],
        "software": {"scikit_learn": sklearn.__version__, "pandas": pd.__version__},
        "seed": SEED,
        "source_links": {
            "organizer": "https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset",
            "uci45": "https://archive.ics.uci.edu/dataset/45/heart+disease",
        },
    }
    JSON_PATH.write_text(json.dumps(audit, indent=2, default=lambda value: int(value) if isinstance(value, np.integer) else float(value) if isinstance(value, np.floating) else str(value)), encoding="utf-8")
    lines = [
        "# Cross-source CAD feature harmonization study", "",
        f"Organizer cohort: {len(primary_raw)}; UCI Heart Disease 45: {len(uci_raw)} across four historical cohorts.", "",
        "## Crosswalk decisions", "",
        "| Field | Harmonization | Confidence/use |", "|---|---|---|",
        "| Age | years → years | Core |", "| Sex | binary codes → male/female | Core |",
        "| Fasting glucose | organizer mg/dL >120 → binary; UCI fbs already uses >120 mg/dL | Core, with missing UCI values imputed in training |",
        "| Chest pain | Typical/Atypical/Nonanginal flags mapped to UCI cp 1/2/3; no-flag mapping is tested both as separate and as asymptomatic | Exploratory sensitivity only |",
        "| Blood pressure | BP mmHg vs resting/admission BP mmHg | Sensitivity feature; organizer context/systolic status is not explicit |",
        "| CAD target | Cath vs num>0 | Near match; threshold boundary differs (<50/>50 vs >=50), and organizer Cath has one vessel-rule disagreement |",
        "", "## Domain-transfer results", "",
        "Each result trains on one complete source and scores on an untouched external cohort. AUC measures ranking; Brier measures probability error; sensitivity/specificity use a fixed 0.5 threshold for illustration only.",
    ]
    for variant, bundle in results.items():
        lines += ["", f"### {variant}", "", f"Inputs: {', '.join(bundle['features'])}", "",
                  f"Chest-pain mapping: {bundle['chest_pain_mapping']}", "",
                  "| Train → test | N | CAD+ | AUC (95% CI) | Brier (95% CI) | Sensitivity | Specificity |", "|---|---:|---:|---:|---:|---:|---:|"]
        def row(label: str, m: dict[str, Any]) -> str:
            auc = "NA" if m["roc_auc"] is None else f"{m['roc_auc']:.3f}"
            auc_ci = m["roc_auc_ci95_stratified_bootstrap"]
            brier_ci = m["brier_ci95_stratified_bootstrap"]
            spec = "NA" if m["specificity_at_0_5"] is None else f"{m['specificity_at_0_5']:.3f}"
            return f"| {label} | {m['n']} | {m['positive']} | {auc} ({auc_ci[0]:.3f}–{auc_ci[1]:.3f}) | {m['brier_score']:.3f} ({brier_ci[0]:.3f}–{brier_ci[1]:.3f}) | {m['sensitivity_at_0_5']:.3f} | {spec} |"
        for cohort, m in bundle["organizer_to_each_uci_cohort"].items():
            lines.append(row(f"Organizer → {cohort}", m))
        lines.append(row("UCI 45 all cohorts → organizer (Cath)", bundle["all_uci_to_organizer"]))
        lines.append(row("UCI 45 all cohorts → organizer (vessel-rule label sensitivity)", bundle["all_uci_to_organizer"]["against_vessel_derived_sensitivity_label"]))
        for cohort, m in bundle["uci_leave_one_cohort_out"].items():
            lines.append(row(f"UCI train other cohorts → {cohort}", m))
    lines += ["", "## Labels and interpretation", "",
              f"Organizer Cath and the any-stenotic-vessel rule agree on {int(agreement.sum())}/{len(agreement)} rows; mismatches: {audit['organizer_cath_vs_any_stenotic_vessel']['mismatch_count']}.",
              "The CSVs were not joined. This is cross-domain transfer, not pooled random-split validation. Features with uncertain semantics are isolated as extension variants. The 95% intervals are class-stratified bootstrap intervals over test rows, conditional on the fitted model; they do not capture model-training or source-population uncertainty.",
              "", "## Source documentation", "",
              "- [UCI Extension of Z-Alizadeh Sani dataset](https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset) — CAD threshold and target description.",
              "- [UCI Heart Disease dataset 45](https://archive.ics.uci.edu/dataset/45/heart+disease) — age, sex, cp, trestbps, fbs, num coding and definitions.",
              "- [Z-Alizadeh Sani feature definitions and units](https://pmc.ncbi.nlm.nih.gov/articles/PMC9698583/) — published field descriptions for BP and FBS.",
              "", "## Limitations", ""]
    lines += [f"- {item}" for item in audit["limitations"]]
    lines += ["", "## Reproduction", "", "```powershell", "python -m ml.harmonize_uci_sources", "```", ""]
    MD_PATH.write_text("\n".join(lines), encoding="utf-8")
    return audit


if __name__ == "__main__":
    report = run()
    print(f"Saved cross-source harmonization report for {report['n_organizer']} + {report['n_uci45']} records: {MD_PATH}")
