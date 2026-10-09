# UCI Heart Disease CAD model study

Rows: 920. Features: age, trestbps, chol, thalach, oldpeak, sex, cp, fbs, restecg, exang, slope, thal. Excluded `ca` (post-angiography).

Evaluation protocol: leave one source cohort out; preprocessing is refit on the other three cohorts for each fold. Threshold 0.5 is fixed. Metrics are exploratory, not clinical validation.

| Model | Held-out cohort | N | ROC AUC | AP | Brier | Sensitivity | Specificity |
|---|---:|---:|---:|---:|---:|---:|---:|
| logistic_regression | cleveland | 303 | 0.830 | 0.814 | 0.165 | 0.691 | 0.829 |
| logistic_regression | hungary | 294 | 0.876 | 0.831 | 0.130 | 0.660 | 0.915 |
| logistic_regression | switzerland | 123 | 0.788 | 0.981 | 0.223 | 0.652 | 0.750 |
| logistic_regression | long_beach_va | 200 | 0.695 | 0.851 | 0.181 | 0.893 | 0.314 |
| logistic_regression | Pooled OOF | 920 | 0.840 | 0.847 | 0.165 | 0.735 | 0.803 |
| random_forest | cleveland | 303 | 0.853 | 0.844 | 0.161 | 0.770 | 0.768 |
| random_forest | hungary | 294 | 0.888 | 0.813 | 0.136 | 0.811 | 0.867 |
| random_forest | switzerland | 123 | 0.763 | 0.974 | 0.177 | 0.774 | 0.625 |
| random_forest | long_beach_va | 200 | 0.700 | 0.831 | 0.184 | 0.765 | 0.510 |
| random_forest | Pooled OOF | 920 | 0.848 | 0.842 | 0.160 | 0.778 | 0.779 |

## Compatibility

Research-only separate CAD candidate. Not input-compatible with the organizer dataset's 55-feature four-target models; do not integrate into the app contract without a validated feature crosswalk and new evaluation.

## Limitations

- Source cohort held out, but the source datasets are historical and heterogeneous; this is not prospective or clinical validation.
- A pooled score can hide major cohort-specific failures; inspect each cohort row.
- Threshold 0.5 is fixed for transparent comparison, not tuned for clinical use.
- UCI label documentation uses a >50% stenosis rule; the dataset 411 organizer label definition may use a slightly different threshold.
- All-data artifacts are refit on all four cohorts for reproducibility and must not be used to claim the reported held-out performance.
