# Local explainability contract

The four saved app models are raw logistic-regression pipelines (CAD, LAD, LCX and RCA). Each pipeline uses the same 55 input fields, with numeric imputation and standardization, categorical imputation and one-hot encoding, followed by the fitted logistic regression. Outcome columns are excluded before either prediction or explanation.

## SHAP attributions

`ml.explain.explain_shap_one(target, row, model, background, feature_categories)` explains the final logistic regression with `shap.LinearExplainer`. It first applies the model's saved preprocessing pipeline, then explains the logistic regression in its raw decision-function output, which is log-odds. Each target uses up to 50 deterministic rows from that model's training split as its background. The explainer is cached by the fitted classifier so requests reuse it.

With an interventional background and a linear model, `LinearExplainer` calculates the closed-form Shapley values. There is no Monte Carlo approximation or sampling noise. The transformed model columns are mapped to their source input feature; the pieces from one-hot columns are summed. Every returned feature includes its name, physiological category, supplied input value, SHAP value and direction, sorted by absolute attribution.

The background defines the reference score. Its expected model log-odds is the base value, and the centered feature values sum to the current model log-odds:

```text
base value + sum(SHAP values) = model log-odds
```

The backend calculates group totals by summing these same original-feature SHAP values. It returns all 55 input-feature contributions so clients can reproduce each group total exactly; the interface chooses a shorter top-five view where appropriate.

## Exact cross-check and fallback

`explain_one(target, row, model=None, top_k=None)` remains the existing exact additive decomposition around a zero transformed baseline: the intercept plus each transformed input times its coefficient equals the model log-odds. For the SHAP background, `exact_centered_attributions()` computes the corresponding exact terms around the background mean. `verify_attribution_consistency()` asserts that the SHAP sum reaches the decision-function score and that each original-feature SHAP value agrees with this independently computed centered coefficient term within `1e-6`. At runtime, a failed consistency check logs a warning instead of interrupting prediction.

If importing or running SHAP fails, the API uses `exact_linear_decomposition` and sets its base value to the model intercept. The `method` and `base_value` fields are optional additions to each explanation item; the existing prediction and explanation array structure stays intact. The frontend labels SHAP or fallback attribution method in the report.

We use SHAP because the models are linear and `LinearExplainer` computes exact attributions for them. LIME's sampling-based approximation is unnecessary here, so LIME is not added. These are model score contributions, not causal effects, medical mechanisms or percentage-point changes in probability.

## Reproduction

```powershell
python scripts/explain_samples.py
python scripts/generate_shap_figures.py
pytest backend/tests
```

`scripts/explain_samples.py` prints the five largest SHAP contributions beside the exact centered coefficient contributions for the low-risk, single-vessel LAD and multi-vessel examples. `scripts/generate_shap_figures.py` writes one global SHAP bar summary per target into `frontend/public/figures/` without overwriting the existing figures.
