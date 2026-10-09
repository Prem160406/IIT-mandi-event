# M1 handoff to M2 and M4

## What is ready

- Four raw logistic regression pipelines for CAD, LAD, LCX and RCA are saved under `artifacts/baseline/`.
- `artifacts/baseline/evaluation.json` and `reports/metrics.json` contain the full reproducible evaluation record, including data/model hashes, exact predictor names, split row indices, package versions, metrics, uncertainty, comparison, threshold, calibration, ablation and split-sensitivity results.
- `reports/figures/` contains report-ready ROC, calibration, confusion-matrix and global logistic contribution figures.
- `ml/explain.py::explain_one(target, row)` returns a raw logistic probability plus exact feature-level additive contributions in log-odds. For a complete M2/M4 response shape, see `reports/explainability.md`.
- `config/targets.yaml` and `config/features.yaml` define target mapping and model input schema. All recorded outcomes are excluded from every model's inputs.
- `reports/feature_metadata.md` defines the current limitation around unknown units and input/reference ranges.
- A second source, UCI Heart Disease (dataset 45), is staged and ETL'd into a cohort-tagged 920-row table. A separate CAD-only study compares logistic regression and random forest under leave-one-cohort-out evaluation; both have pooled OOF AUC near 0.84, but performance varies by cohort (especially specificity on Long Beach VA, and class prevalence on Switzerland). The evaluation report is [`uci_heart_disease_45_model_study.md`](uci_heart_disease_45_model_study.md), and the source/schema audit is [`uci_heart_disease_45_audit.md`](uci_heart_disease_45_audit.md).
- The supplemental UCI model artifacts in `artifacts/uci_heart_disease_45/` are separate CAD research candidates, trained on 12 inputs after excluding `ca` (angiography-derived). They are not compatible with the organizer dataset's 55-feature four-target model interface and must not replace or be wired into the current app. Reproduce the experiment with `python -m ml.train_uci_heart_disease` after ETL.
- A separate cross-source harmonization study is in [`cross_source_harmonization.md`](cross_source_harmonization.md), reproducible with `python -m ml.harmonize_uci_sources`. It keeps the datasets separate and evaluates domain transfer using age, sex and fasting glucose >120 mg/dL, then treats BP and chest-pain mappings as sensitivity extensions. The results show modest transfer with the strict core; chest pain improves ranking in several cohorts, but one source has 30 records with no chest-pain category flag. No cross-source model is app-ready or replaces the four organizer-data models.

## Model selection and interpretation

Use the raw logistic artifacts with `explain_one` so the returned probability and additive explanation describe the same model. Sigmoid calibrated artifacts are experiments; the current exact explanation helper does not explain them. The random forest is a comparison candidate, not a selected artifact. All scores and thresholds are internal demonstrations on a small dataset, not clinical validation or a safe decision threshold. Vessel performance is materially weaker and more variable than the CAD result.

The explanation is an exact decomposition of fitted logistic-model log-odds, grouped back to original fields. It is not SHAP, a causal explanation, a biological mechanism or a percentage-point probability effect. Display it as a model-score contribution.

## Reproduce

From the repository root, install pinned dependencies and run:

```powershell
python -m pip install -r requirements.txt
python -m ml.train_baseline
```

The training command rebuilds four models and writes the JSON evaluation records plus figures. It takes several minutes because it includes repeated/nested cross-validation and repeated split analyses. It expects the organizer workbook at the configured `data/raw/` path.

## Open integration items

1. M2 should call the raw logistic model and helper for all four targets, enforce the agreed input schema, and expose the helper output without claiming calibrated probabilities.
2. M4 should read `reports/metrics.json` and use the pre-generated figures; preserve the exploratory/model-score labels and limitations.
3. The team must obtain authoritative units, allowed input ranges and category definitions before accepting arbitrary user-entered measurements or displaying reference flags.
4. External validation on an independent cohort remains necessary before making generalization or clinical claims.
