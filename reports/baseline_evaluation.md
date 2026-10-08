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
- The raw logistic model's demonstration threshold is fixed at `0.5`, not tuned to a clinical use. Its probabilities are uncalibrated; Brier scores are included as a baseline measure.
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

## Threshold trade-offs (training data only)

These are descriptive sensitivity/specificity pairs computed from one set of five-fold out-of-fold probabilities on the training partition. They show how the operating point changes; they do not select a threshold. Lower thresholds raise sensitivity while generally reducing specificity. Full precision, F1, predicted-positive rates and all threshold values are in the evaluation JSON.

| Target | 0.25 Sensitivity / Specificity | 0.35 Sensitivity / Specificity | 0.50 Sensitivity / Specificity | 0.65 Sensitivity / Specificity | 0.75 Sensitivity / Specificity |
|---|---:|---:|---:|---:|---:|
| CAD | 0.919 / 0.710 | 0.896 / 0.725 | 0.884 / 0.768 | 0.827 / 0.826 | 0.803 / 0.855 |
| LAD | 0.865 / 0.624 | 0.823 / 0.644 | 0.730 / 0.693 | 0.660 / 0.792 | 0.589 / 0.822 |
| LCX | 0.747 / 0.537 | 0.674 / 0.605 | 0.600 / 0.673 | 0.421 / 0.748 | 0.347 / 0.810 |
| RCA | 0.736 / 0.470 | 0.659 / 0.556 | 0.549 / 0.715 | 0.407 / 0.795 | 0.330 / 0.821 |

## Predeclared model comparison (training CV only)

The fixed candidate set compares L2 logistic regression with a class-balanced random forest (300 trees, square-root feature sampling, minimum leaf size 3). Both use the same repeated stratified folds and fold-local preprocessing. `Δ AUC` is the mean paired fold difference (forest minus logistic); the fold-win count is descriptive because the repeated folds are correlated, not an independent significance test.

| Target | Logistic AUC (mean ± SD) | Forest AUC (mean ± SD) | Δ AUC (RF − LR) | RF higher AUC folds | Logistic F1 | Forest F1 | Logistic recall | Forest recall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CAD | 0.924 ± 0.042 | 0.921 ± 0.051 | −0.003 | 7 / 15 | 0.890 | 0.907 | 0.867 | 0.925 |
| LAD | 0.811 ± 0.071 | 0.831 ± 0.057 | +0.020 | 9 / 15 | 0.754 | 0.802 | 0.730 | 0.835 |
| LCX | 0.687 ± 0.047 | 0.728 ± 0.070 | +0.041 | 9 / 15 | 0.574 | 0.521 | 0.607 | 0.470 |
| RCA | 0.712 ± 0.064 | 0.714 ± 0.052 | +0.003 | 8 / 15 | 0.570 | 0.457 | 0.602 | 0.390 |

The forest has a modest mean AUC increase for LCX, but it does not improve that target's mean F1 or recall at the fixed threshold; the direction is not consistent across folds. For CAD and RCA, mean AUC is nearly unchanged. These results do not establish a reliable winner. The logistic models remain the saved baseline. The holdout is used only for raw and calibrated logistic evaluation, never for model selection; no forest holdout score is reported.

## Sigmoid calibration experiment

A sigmoid (Platt) calibrator was predeclared and fitted with five-fold stratified CV on the training partition. It was then applied once to the reserved holdout. No calibration method or operating threshold was selected using holdout results. Brier difference is paired (`calibrated − raw`); its interval resamples the same holdout records within each class.

| Target | Raw Brier | Sigmoid Brier | Paired Brier difference (95% CI) | Raw AUC | Sigmoid AUC | Sigmoid sensitivity / specificity at 0.5 |
|---|---:|---:|---:|---:|---:|---:|
| CAD | 0.143 | 0.124 | −0.019 (−0.052–0.013) | 0.889 | 0.881 | 0.884 / 0.667 |
| LAD | 0.203 | 0.181 | −0.022 (−0.061–0.013) | 0.793 | 0.802 | 0.750 / 0.640 |
| LCX | 0.266 | 0.222 | −0.044 (−0.087–−0.002) | 0.633 | 0.631 | 0.292 / 0.892 |
| RCA | 0.245 | 0.222 | −0.024 (−0.066–0.013) | 0.641 | 0.641 | 0.043 / 0.921 |

The calibrated probabilities have similar AUCs and lower Brier point estimates on this holdout, but most paired intervals include zero. At a fixed `0.5` cutoff, calibrated LCX/RCA sensitivities are especially low. Calibration changes probability scale; it does not preserve the raw model's operating point. Therefore the sigmoid models are saved as experimental artifacts and are not selected for the application. If we later use them, threshold trade-offs must be recomputed from training-only cross-fitted calibrated probabilities for the chosen use case.

## Interpretation and next work

The CAD and LAD baseline results look stronger than LCX and RCA on this one split, but a 303-record dataset and a 61-record holdout make the estimates noisy. The train-only CV spread and holdout differences show why these scores are not proof of generalization. Do not use them as clinical performance claims. In particular, the LCX/RCA operating-point metrics show substantial false negatives at the fixed threshold; changing a threshold requires an explicitly chosen use case and training-only analysis.

Next M1 actions: evaluate probability calibration within training data; run split sensitivity and feature-group ablations; and record all failures or unstable results. External validation is required before claims about performance in another population.
