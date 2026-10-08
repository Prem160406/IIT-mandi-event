# Logistic-regression baseline evaluation

**Run date:** 2026-10-08  
**Status:** Initial internal baseline; exploratory and not for diagnosis or treatment decisions.  
**Full record:** [`artifacts/baseline/evaluation.json`](../artifacts/baseline/evaluation.json)  
**Model artifacts:** [`artifacts/baseline/`](../artifacts/baseline/)  
**Reproduce:** `python -m ml.train_baseline`

## Protocol

- Four separate binary classifiers: CAD (`Cath`), LAD, LCX and RCA. Every target/outcome column is removed from predictors for every model.
- Class-weighted, L2-regularized logistic regression with median imputation and scaling for numeric fields; most-frequent imputation and one-hot encoding for categorical fields. All preprocessing is fitted within the model pipeline and within each CV fold.
- Fixed random seed `2026`. A stratified 80/20 holdout is reserved before model fitting. Repeated stratified five-fold CV (three repeats) is run only on the training partition. The holdout is not used for model selection.
- The demonstration threshold is fixed at `0.5`, not tuned to a clinical use. Probabilities are not calibrated. Brier scores are included as an uncalibrated baseline measure.
- Holdout intervals use 2,000 stratified percentile bootstrap replicates, resampling within each observed class and keeping the class counts fixed. They reflect sampling variation conditional on this split; they do not include uncertainty from refitting the model or changing populations.
- Environment: Python 3.12.14, scikit-learn 1.9.1; exact package versions are pinned in `requirements.txt`. Raw data and model hashes, feature names, split row indices, versions and metrics are recorded in the JSON.

## Results

| Target | Positive / negative | CV ROC-AUC (mean ± SD) | Holdout ROC-AUC (95% CI) | Sensitivity (95% CI) | Specificity (95% CI) | Accuracy | Precision | F1 | Brier (95% CI) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CAD | 216 / 87 | 0.924 ± 0.042 | 0.889 (0.791–0.961) | 0.814 (0.698–0.930) | 0.722 (0.500–0.889) | 0.787 | 0.875 | 0.843 | 0.143 (0.078–0.221) |
| LAD | 177 / 126 | 0.811 ± 0.071 | 0.793 (0.673–0.899) | 0.722 (0.556–0.861) | 0.680 (0.480–0.880) | 0.705 | 0.765 | 0.743 | 0.203 (0.132–0.280) |
| LCX | 119 / 184 | 0.687 ± 0.047 | 0.633 (0.485–0.768) | 0.458 (0.250–0.667) | 0.703 (0.541–0.838) | 0.607 | 0.500 | 0.478 | 0.266 (0.199–0.340) |
| RCA | 114 / 189 | 0.712 ± 0.064 | 0.641 (0.506–0.778) | 0.478 (0.303–0.652) | 0.737 (0.579–0.868) | 0.639 | 0.524 | 0.500 | 0.245 (0.183–0.307) |

Holdout contains 61 records per target. Sensitivity, specificity, precision and F1 use the fixed 0.5 threshold. The CAD label is the workbook's observed `Cath` label; one disagreement with the vessel-derived CAD rule remains unchanged and is documented in [`data_audit.md`](data_audit.md).

## Interpretation and next work

The CAD and LAD baseline results look stronger than LCX and RCA on this one split, but a 303-record dataset and a 61-record holdout make the estimates noisy. The train-only CV spread and holdout differences show why these scores are not proof of generalization. Do not use them as clinical performance claims. In particular, the LCX/RCA operating-point metrics show substantial false negatives at the fixed threshold; changing a threshold requires an explicitly chosen use case and training-only analysis.

Next M1 actions: inspect threshold trade-offs using training-only out-of-fold predictions; evaluate probability calibration within training data; compare a small set of predeclared alternatives without touching the holdout; run split sensitivity and feature-group ablations; and record all failures or unstable results. External validation is required before claims about performance in another population.
