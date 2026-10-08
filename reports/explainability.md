# Local explanation contract

`ml.explain.explain_one(target, row, model=None, top_k=None)` provides a faithful per-record explanation for one of the saved **raw logistic-regression** models. The calibrated experiment and random-forest candidate are not supported by this helper.

```python
from ml.data_prep import load_dataset
from ml.explain import explain_one

patient_row = load_dataset().iloc[[0]]
result = explain_one("CAD", patient_row, top_k=10)
```

The output contains the raw model probability and an additive list of feature contributions in log-odds space. Numeric scaling and one-hot encoding are part of the saved fitted pipeline; encoded contributions are summed back to their original input field. Positive contributions push toward the target's positive class, and negative contributions push away. The full-precision contributions sum to the model log-odds minus its intercept, up to floating-point rounding.

This is an exact decomposition of the logistic model calculation, not SHAP, not a causal attribution and not a medical mechanism. The input row is checked against the model's exact feature schema; known outcome columns are dropped before prediction, and other missing/extra feature names raise an error. For an app response, M2 should return the same raw logistic model probability that this explanation describes. If the app switches to a calibrated or tree model, it must use an explanation method compatible with that model and keep the displayed probability and explanation aligned.

## Handoff fields

- `target`, `positive_probability`
- `model_log_odds`, `intercept_log_odds`, `contribution_sum_log_odds`
- `feature_contributions[]`: `feature`, `input_value`, `log_odds_contribution`, `direction`
- `explanation_method`, `interpretation_warning`

The frontend should label contributions as **model score contributions**, not risk factors or causes, and should not convert them into a percentage-point probability change without an explicit method. The contribution values are additive in log-odds; probability effects are nonlinear and depend on all inputs together.
