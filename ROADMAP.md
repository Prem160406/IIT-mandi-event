# Team Roadmap and Progress Tracker

**Project:** Cardiovascular Risk Visualization & Prediction  
**Team:** M1 (ML), M2 (Backend and integration), M3 (3D), M4 (Frontend, docs and video)  
**Plan source:** [`README.md`](README.md) contains the detailed requirements, architecture and implementation notes. This file is the short execution tracker.  
**Last checked:** 2026-10-08

> Update this page as work is completed. A task is **Ready** only when its listed output exists, its acceptance checks pass, and the next owner has enough information to use it.

## Status at a glance

| Area | Owner | Status | Ready means |
|---|---|---|---|
| Project planning | All | Ready | Roles, scope and intended interfaces are documented in `README.md`. |
| ML and data pipeline | M1 | In progress | Reproducible training artifacts, metrics and explanation helper are handed to M2/M4. |
| Backend and integration | M2 | Not started | API runs from a clean setup and matches the agreed response contract. |
| 3D experience | M3 | Not started | Heart scene responds to API probabilities and supports the agreed interactions. |
| Dashboard and submission materials | M4 | Not started | The complete user flow, report and demo are ready. |

**Repository baseline (2026-10-08):** The organizer ZIP and extracted workbook are preserved in `data/raw/`; their workbook payload hashes match. The initial data audit is complete, `Cath` is mapped as the observed CAD label, and one disagreement with the vessel-derived rule is documented for sensitivity analysis. Target/feature configs and a repeatable logistic-regression baseline training script are present; model training is pending dependency installation. M2–M4 implementation remains not started. Change statuses only when there is evidence in the repo or a linked issue/PR.

## Milestones

| Milestone | Goal | Exit check | Status |
|---|---|---|---|
| M0 — Contract frozen | Agree on targets, features, API response, artery keys, branch/review process and deadline. | M1/M2/M3/M4 confirm the shared contract; M2's mock response is available to M3/M4. | Not started |
| M1 — Foundations | Each owner has a first usable component. | M1 has EDA/config/baseline plan; M2 has mock API; M3 has a rotating scene or documented mesh fallback; M4 has UI shell/store/disclaimer. | In progress (M1 data audit) |
| M2 — Vertical slice | Demonstrate one end-to-end prediction. | Patient input → API → CAD/vessel probabilities and explanation → dashboard and 3D colors. | Not started |
| M3 — Feature complete | Finish required interactions and integration. | Core acceptance checklist below passes; only polish and documentation remain. | Not started |
| M4 — Freeze and submit | Package a reproducible, explainable demo. | Clean setup succeeds, report/video links work, limitations and credits are documented. | Not started |

The README's Day 0–7 schedule is a relative sequence, not a calendar commitment. Confirm the actual hackathon deadline and submission rules before assigning dates.

## Work packages

### M1 — ML and data

**Owns:** `ml/`, `models/`, `reports/`, `notebooks/`, `data/`, `config/features.yaml`, `config/targets.yaml`, and ML training scripts.

| Work | Status | Output / acceptance check | Handoff |
|---|---|---|---|
| Inspect dataset; record column names, types, missingness, duplicates, class balance and units. Confirm which column is the overall CAD label. | In review | `reports/data_audit.md` and `.json` record the 303-row audit; `Cath` is primary and its one vessel-rule disagreement is retained for sensitivity analysis. Units still need verification. | M2, M4 |
| Create feature/target configs and one shared leakage-exclusion function. | In review | `features.yaml`, `targets.yaml`, and `ml/data_prep.py` are present; outcomes are excluded from X. Units and ranges remain open. | M2, M4 |
| Build reproducible preprocessing and stratified data split. | In progress | `ml/train_baseline.py` keeps preprocessing inside each fold and reserves a fixed, stratified holdout; split seed and counts are written to the report. | M2 |
| Train and compare baselines for CAD, LAD, LCX and RCA; calibrate and choose thresholds. | In progress | First fixed logistic-regression baseline trained; metrics and four model artifacts are in `artifacts/baseline/`, summarized in `reports/baseline_evaluation.md`. Comparative models, calibration and threshold analysis remain future work. | M2, M4 |
| Save deployment models and metadata. | Not started | Per-target model artifacts include feature list, threshold, metrics, versions, date and seed. | M2 |
| Implement SHAP explanation helper and generate report figures. | Not started | `explain_one(target, row)` returns readable feature values, contributions and groups for all targets; figures/metrics are reproducible. | M2, M4 |
| Run the mathematical robustness review and sensitivity experiments. | Not started | Per-target counts, split/fold rationale, threshold curves, stability/ablation findings and limitations are recorded; weak or undefined results remain visible. | M2, M4 |
| Add one-command retraining and ML report section. | Not started | Training can be rebuilt from documented raw data; report numbers trace to saved outputs. | All |

**M1 ready to hand off when:** M2 can load all four models and call the explanation helper using the documented configs; M4 can use `reports/metrics.json` and figures without reconstructing results.

### M2 — Backend and integration

**Owns:** `backend/`, `config/arteries.json`, `scripts/`, CI/test setup; `requirements.txt` jointly with M1.

| Work | Status | Output / acceptance check | Handoff |
|---|---|---|---|
| Freeze API/config contract and publish mock `/predict`. | Not started | Request/response examples match README; mock includes CAD, all vessels, explanations, missing fields and disclaimer. | M3, M4 |
| Build config loader and `/health`, `/features`, `/samples`. | Not started | Forms and validation are driven by shared configs; sample cases are documented. | M4 |
| Implement `/predict` with real models, thresholds, risk levels and explanations; implement `/metrics`. | Not started | Models load once; response shape matches mock; input errors are clear. | M4, M3 |
| Integrate, add consistency checks and run scripts. | Not started | API keys match artery config; Windows/Mac run steps are documented; end-to-end flow works. | All |
| Add API/schema/leakage/config/smoke tests and integration notes. | Not started | Tests cover required contracts and known failure cases. | All |
| Implement input and prediction quality flags for edge cases. | Not started | Missing fields, invalid inputs, low-support targets and CAD/vessel disagreements are handled explicitly in the response/UI contract. | M1, M4 |

**M2 ready to hand off when:** M3/M4 can use the mock immediately, then switch to the real API without changing the agreed response shape.

### M3 — 3D scene

**Owns:** `frontend/src/three/`, `frontend/public/models/`, `assets/`, and `config/arteries.json` jointly with M2.

| Work | Status | Output / acceptance check | Handoff |
|---|---|---|---|
| Select a usable heart mesh or procedural fallback; record author/license. | Not started | Mesh choice and attribution are documented; fallback decision is clear. | M2, M4 |
| Clean/export the model and confirm node names. | Not started | `heart.glb` loads with `Heart_Body`, `LAD`, `LCX`, `RCA` (or documented procedural equivalent). | M2 |
| Build scene, controls, loading state and probability-to-color mapping against mock data. | Not started | Rotation/zoom work; neutral state before prediction; low/moderate/high legend is visible. | M4 |
| Add vessel selection, labels, camera focus/reset and shared state wiring. | Not started | Selecting a vessel in 3D and selecting its dashboard card stay in sync. | M4 |
| Check boundary probabilities and model/config mismatches. | Not started | Color bands match documented thresholds; no prediction or disagreement is silently hidden or rewritten. | M2, M4 |
| Check performance and document the 3D pipeline. | Not started | Usable on an ordinary laptop; mesh license and schematic limitations are disclosed. | All |

**M3 ready to hand off when:** M4 can render the scene in the app and pass the documented selected target and vessel probabilities; M2 has the final artery/node mapping.

### M4 — Frontend, docs and video

**Owns:** `frontend/` except `src/three/`, `docs/`, `README.md`, `ROADMAP.md`, and the demo video.

| Work | Status | Output / acceptance check | Handoff |
|---|---|---|---|
| Create UI shell, shared store, disclaimer and mock API connection. | Not started | App displays disclaimer and can show a mock prediction without waiting for ML. | M3 |
| Build feature-driven input form and sample patient selection. | Not started | Fields/groups/ranges come from `/features`; loading/error states are clear. | M1, M2 |
| Build result cards, SHAP/group charts and measurement table. | Not started | Values and explanations use the agreed API shape; target selection syncs with M3. | All |
| Show uncertainty, missing-data and limitation context clearly. | Not started | Probability, illustrative threshold, missing-field warnings, model evaluation and non-diagnostic disclaimer are visible without implying certainty. | M1, M2 |
| Finish responsive UI, model performance/about panels and live-mode option. | Not started | Required user flow works at desktop and small-screen sizes. | All |
| Compile report and demo materials. | Not started | Report is within six pages; credits, limitations, results and disclaimer are included; video is 3–10 minutes and link is verified. | All |

**M4 ready to hand off when:** a teammate can follow the README on a clean clone, run the app, understand its limitations and reproduce the demo flow.

## Technical stack, APIs and what each is for

The stack below follows the detailed plan in `README.md`. It is a planned stack, not a claim that the tools or endpoints have already been implemented. Pin compatible package versions at kickoff and record them in the dependency files.

### Data and model tools

| Tool / API | Planned use | Owner / boundary |
|---|---|---|
| UCI Machine Learning Repository, dataset 411; `ucimlrepo.fetch_ucirepo(id=411)` | Obtain the Extension of Z-Alizadeh Sani dataset for initial EDA. Save a credited, versioned local copy in `data/raw/` so later training does not depend on a live download. Verify columns and label mapping from the actual file before modeling. | M1. The UCI page describes 303 records and says CAD is derived from vessel status; this small dataset limits how strongly results can be generalized. |
| pandas, NumPy | Load, inspect, clean and transform tabular data; report data types, label counts and data quality. | M1 |
| scikit-learn | `Pipeline` / `ColumnTransformer` preprocessing, logistic-regression and random-forest baselines, stratified cross-validation, metrics and probability calibration. | M1. Preprocessing and any selection/resampling must be fit inside each training fold. |
| XGBoost (comparison candidate) | Compare a small, regularized gradient-boosting model with the simpler baselines. Keep only if it improves validation results without unstable behavior. | M1. Optional candidate, not a required dependency if setup or results do not justify it. |
| SHAP | Per-patient and global feature contributions for all four targets; group one-hot contributions back to readable original fields. | M1 computes and packages `explain_one`; M2 serves results; M4 displays them. Contributions describe model behavior, not causes or medical mechanisms. |
| matplotlib / seaborn | Save ROC, precision-recall, calibration, confusion-matrix and SHAP figures for review and the report. | M1 |
| joblib + JSON/YAML | Persist fitted pipelines and metadata; share feature, target and artery configuration; make model outputs and settings traceable. | M1 owns model metadata and `features.yaml`/`targets.yaml`; M2/M3 share `arteries.json`. |
| pytest | Automate leakage, API schema, configuration consistency and sample-patient smoke checks. | M2 leads tests; M1 contributes leakage and model checks. |

### Project API endpoints

These are our own local FastAPI endpoints; they are not external clinical APIs. The browser talks only to the backend. M2 owns implementation and the API contract; M4 builds the form/dashboard from it.

| Method and path | What uses it | Expected behavior |
|---|---|---|
| `GET /health` | Run scripts and local troubleshooting | Reports that the service and required models/configs are loaded. |
| `GET /features` | Frontend form | Returns field names, types, groups, units, ranges/defaults and reference ranges from config. |
| `GET /samples` | Demo workflow | Returns a few clearly labeled example patients for low, single-vessel and multi-vessel demonstrations. |
| `POST /predict` | Frontend after the user selects a sample or enters values | Accepts feature values; returns model version, missing-field list, CAD probability, LAD/LCX/RCA probabilities, thresholds/risk labels, explanations and disclaimer. The response follows the README contract. |
| `GET /metrics` | Model-performance view and report | Serves saved evaluation results from `reports/metrics.json`, including the evaluation split and metric definitions. |

### App and integration tools

| Tool | Planned use | Owner |
|---|---|---|
| Python 3.10 or 3.11, virtual environment, pinned `requirements.txt` | Reproduce data prep, training, explainability and API environment across team machines. Confirm one minor version at kickoff. | M1 + M2 |
| FastAPI, Pydantic, Uvicorn | Define, validate and run the JSON API; provide interactive local API docs at `/docs`. | M2 |
| React + Vite, Zustand, Recharts, Axios | Build the input flow, shared prediction/selection state, charts and API client. | M4 |
| Three.js + React Three Fiber + drei | Load the heart mesh, display vessel probabilities, and implement rotate/zoom/select interactions. | M3 |
| Blender + glTF/GLB | Clean or construct the heart/artery asset; keep source, node names and licensing/attribution with the project. | M3 |
| PowerShell and shell run scripts | Start the backend and frontend consistently on Windows and Mac/Linux. | M2 |
| GitHub branches, issues and reviewed PRs | Divide work by owner, record readiness and handoff notes, and catch integration problems early. | All |

**Not part of this project:** Sentinel data, Google Earth Engine, OpenDrift, AIS feeds, PostGIS and oil-spill mapping tools from the reference deck solve a different problem. Do not add unrelated external APIs. The planned public input is the cited UCI dataset; the deployed prototype uses our local trained artifacts.

## Model quality: accuracy, precision and repeatability

These steps are intended to make estimates more credible and stable; they do not guarantee a higher score. Because the dataset has only 303 records, a high metric alone is not evidence that the system will generalize to other populations or clinical settings.

### Reduce leakage and overfitting

- [ ] Confirm the four target columns from the actual dataset file. Keep CAD, LAD, LCX, RCA and Cath out of every input matrix; add an automated assertion for each target-specific model.
- [ ] Freeze a stratified held-out test split and random seed before model comparison. Do not use this split to pick features, tune models, calibrate probabilities or choose thresholds.
- [ ] Compare simple baselines first (logistic regression and random forest), then a small XGBoost search only if it is supportable. Put imputing, encoding, scaling, feature selection and any class balancing inside the CV pipeline.
- [ ] Use repeated stratified folds on the training partition. Check positive counts for each target before selecting the number of folds; if rare classes make a planned split invalid, reduce folds and document why.
- [ ] Choose model settings, calibration and operating thresholds using training-only cross-validation / out-of-fold predictions. If nested CV is feasible, use it for tuning; otherwise record the simpler selection procedure and avoid presenting CV results as an independent test.
- [ ] Evaluate the frozen pipeline once on the held-out test set. Then retrain a deployment model on all available data only after evaluation, and keep the reported held-out metrics tied to the earlier frozen evaluation.

### Measure more than one kind of performance

Report each target separately (CAD, LAD, LCX, RCA), along with positive/negative counts and the threshold used. Use:

- **Accuracy** for overall correctness, with class balance shown beside it.
- **Precision** for the fraction of positive predictions that are positive in the dataset; **recall/sensitivity** for the fraction of dataset positives detected. Explain the tradeoff when selecting a screening-oriented threshold.
- **Specificity, F1, confusion matrix, ROC-AUC and PR-AUC.** PR-AUC is useful to see positive-class performance when targets are imbalanced.
- **Brier score and calibration plot** to check whether probability estimates behave like probabilities. Show the default 0.5 decision and the separately selected operating threshold; do not hide either.
- **Uncertainty intervals** for held-out metrics using a documented bootstrap procedure. Always show sample counts; with a small test set, intervals may be wide or unstable.

### Check stability and explainability

- [ ] Save seeds, exact row indices, raw data source/version and a data checksum, dependency versions, config, feature list, selected model settings and training date in artifacts/metadata.
- [ ] Make one training command rebuild the preprocessing, models, metrics and figures from the saved raw dataset; compare repeated runs under the pinned environment.
- [ ] Compare explanation patterns across CV folds or bootstrap refits. Report when top features vary, and never imply SHAP proves causation.
- [ ] Run a feature-group ablation (demographic, symptoms/exam, ECG, lab/echo) to show what each group adds under the same CV protocol. Treat it as an analysis, not a claim that any feature group causes disease.
- [ ] Report subgroup counts and performance only where there are enough examples to make the numbers interpretable. With this dataset, small subgroup results may be descriptive only or too sparse to compare.
- [ ] Track model/config version and missing input fields in each prediction response. Reject out-of-range values and show when missing data may weaken the result.

### Beyond the baseline: useful differentiators

The oil-spill deck's strongest ideas are a staged pipeline, uncertainty carried between stages, an evidence chain for each ranked lead, and a human making the final decision. The cardiac equivalent is:

1. **Calibrated, uncertainty-aware results:** show each target's probability, threshold, calibration evidence and data limitations; show uncertainty only when the method and sample size support it.
2. **An explanation attached to every prediction:** show the patient's top contributing measurements and their direction, plus group-level context. Label this as model contribution, not diagnosis or causal evidence.
3. **A transparent consistency check:** compare the overall CAD output with the three vessel outputs. Flag unexpected disagreement for inspection; do not silently rewrite or force probabilities to agree.
4. **Human review by design:** present the app as educational decision support. It ranks model outputs for inspection and never says a user has CAD or recommends treatment.
5. **A reproducible model card:** document dataset source/size, exclusions, validation protocol, per-target metrics, calibration, limitations, intended use and unsupported uses.

These are the proposed additions that can distinguish the project through careful engineering and honest reporting, rather than adding technology unrelated to the problem.

## Mathematical scope and failure-mode review

### Define the prediction before choosing the model

The UCI data supports classifying the recorded CAD/vessel stenosis labels in this cohort. It does **not** by itself support predicting a future heart attack, a patient's future cardiovascular risk, or a clinical diagnosis. In notation, for each target (t \in \{CAD, LAD, LCX, RCA\}), estimate (p_t(x)=P(Y_t=1\mid X=x)) from the available non-leakage measurements. The CAD label is defined in the source data as positive when at least one major vessel is stenotic; verify that rule against the actual file. Cath and all outcome labels stay out of (X).

Before splitting data, M1 should tabulate all four outcome counts and the joint label patterns. This determines whether the proposed folds can contain enough positive and negative examples. Agree at kickoff whether to use one shared patient-level split that preserves the joint labels where possible, or separate target-stratified splits; record the reason and resulting counts. If a vessel target is too sparse for a stable held-out estimate, say so instead of hiding it behind an overall score.

### Quantities to inspect

- **Discrimination:** ROC-AUC and PR-AUC describe ranking, not whether a probability is trustworthy. Report positive prevalence and precision/recall at any displayed threshold.
- **Calibration:** compare predicted probabilities with observed frequencies. Report Brier score (\frac{1}{n}\sum_i(p_i-y_i)^2), a calibration plot, and—only when there are enough cases to estimate them meaningfully—calibration-in-the-large and slope. The ideal calibration intercept is 0 and slope is 1.
- **Threshold behavior:** show the precision/recall/specificity trade-off over candidate thresholds selected from training-only predictions. Without an agreed use and external validation, call any threshold a demo operating point, not a clinically optimal cutoff.
- **Uncertainty and stability:** bootstrap intervals for evaluation metrics and prediction variation across refitted bootstrap models are different quantities. Label them separately; model-to-model variation is not automatically a calibrated patient-level confidence interval.
- **Model selection optimism:** tune only within training folds and keep the final test set untouched. A small search over a few candidates is preferable to repeatedly trying models until the test score looks good.

### Edge cases and expected behavior

| Scenario | Risk | Planned response / check |
|---|---|---|
| One or more input fields are missing | Imputation can conceal that the input is incomplete. | Allow only the documented missing-field behavior; return the field names/count, show a warning, and test representative missingness patterns. Reject a request with no usable features. |
| Unknown category, malformed value, NaN/Infinity, or value outside configured range | Encoding errors or nonsensical outputs. | Validate with Pydantic/config; return a clear 422 response. Never silently clip values or map an unknown category to a plausible clinical value. |
| A rare target has too few positives for a fold or test split | AUC/precision/recall or calibration may be undefined or highly unstable. | Check counts before fitting; adapt the split/fold plan before model selection, report undefined metrics as such, include counts/intervals, and mark that target as not reliably evaluated if necessary. |
| Overall CAD prediction conflicts with vessel predictions | Independent classifiers can disagree even though the dataset defines CAD from the vessel labels. | Return a quality flag and show all outputs; investigate the label rule/model behavior. Do not silently change one probability to force agreement. |
| A value is near a threshold or a small plausible measurement change flips the label | A binary label can look more certain than the underlying estimate. | Display probability and threshold together; add a predeclared perturbation/sensitivity check for numeric features and show the probability change. Keep the risk band visibly distinct from ground truth. |
| A patient differs from the 303-row training cohort or comes from another setting | Internal validation may not transport; predicted probabilities can be miscalibrated. | Mark external populations as unvalidated. Do not claim deployment readiness or recalibrate on demo/test examples. Seek a separate dataset before making transport claims. |
| Correlated predictors or one-hot expansion changes the SHAP ranking | Feature attribution can be unstable and is not causal. | Aggregate encoded columns to original features, inspect explanation stability across refits, and disclose variation/correlation limitations. |
| A saved model is loaded with different preprocessing/config/library versions | Inputs or probabilities can change or artifacts can fail. | Save versions and config hash with each model; check them at startup and fail clearly on incompatible metadata. |

### Robustness experiments to prioritize

1. **Leakage audit:** unit-test that no outcome/angiography column reaches any training or inference feature list; test all four target configurations.
2. **Split sensitivity:** repeat the predeclared CV with fixed, recorded seeds and compare per-target metric distributions, not only their mean. If model ordering changes often, prefer the simpler model or report that selection is uncertain.
3. **Threshold sensitivity:** plot precision, recall and specificity against threshold and show how many test records change label near candidate cutoffs. Do not optimize on the test set.
4. **Input perturbation:** for continuous inputs, vary one value within a documented plausible measurement range and observe probability change; for categorical inputs, test valid category changes. Flag brittle outputs for review rather than promising monotonic clinical behavior.
5. **Ablation and subgroup checks:** remove one feature group at a time under the same CV plan; inspect subgroup counts before showing subgroup metrics. Treat sparse subgroup findings as exploratory.
6. **External validation gate:** a future, independent cohort is required before claiming transportability. Until then, call this an internally evaluated prototype on a small public dataset.

Use these experiments to find failure modes, not to keep modifying the system until every chosen example looks favorable. A result that is unstable or weak is still a useful finding and should appear in the handoff/report.

**Ownership:** M1 owns the statistical protocol and offline robustness analysis; M2 owns request validation, response quality flags and contract tests; M3 owns the probability-to-color boundary checks; M4 owns how uncertainty, warnings and limitations are explained to users.

## How a teammate or demo user will use the system

1. **Set up:** clone the repo, use the pinned Python and Node versions, install dependencies, and run the documented Windows or Mac/Linux start script. M1 runs the documented training command only when rebuilding model artifacts is needed.
2. **Check service readiness:** open the app; M2's backend health route should indicate that models/configs loaded. M2's `/docs` page is for local API inspection, not the normal user flow.
3. **Choose inputs:** select a clearly labeled sample patient or enter values in the grouped form. The UI gets field names, types and ranges from `/features` and offers basic validation.
4. **Request a prediction:** press Predict. The form sends one JSON request to `POST /predict`; missing fields and input validation are reported rather than concealed.
5. **Review the result:** inspect CAD and vessel probabilities, thresholds, calibration context and SHAP contributions; rotate/select the 3D model to see the same vessel outputs. Use `/metrics` for the saved model evaluation.
6. **Interpret cautiously:** the demo should state that the tool is not a diagnostic device and that results are limited by the small public dataset. Example rows are demonstrations, not patient advice.

The demo should use a low-risk, single-vessel and multi-vessel example plus one uncertain case if the held-out data supports them. If no suitable example exists, use a clearly labeled synthetic sample rather than selecting a case based on favorable test performance.

## Reference links for implementation

- [UCI Extension of Z-Alizadeh Sani dataset](https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset) — dataset description, download and attribution/license.
- [UCI `ucimlrepo` package](https://github.com/uci-ml-repo/ucimlrepo) — supported Python fetch interface.
- [scikit-learn repeated stratified cross-validation](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.RepeatedStratifiedKFold.html) and [probability calibration](https://scikit-learn.org/stable/modules/calibration.html).
- [FastAPI tutorial](https://fastapi.tiangolo.com/tutorial/), [response models](https://fastapi.tiangolo.com/tutorial/response-model/) and [CORS](https://fastapi.tiangolo.com/tutorial/cors/).
- [SHAP TreeExplainer](https://shap.readthedocs.io/en/latest/generated/shap.TreeExplainer.html) and [SHAP API examples](https://shap.readthedocs.io/en/latest/api_examples.html).
- [BMJ guide to developing clinical prediction models](https://www.bmj.com/content/386/bmj-2023-078276) — discrimination, calibration, validation and decision analysis.
- [BMJ evaluation of clinical prediction models](https://www.bmj.com/content/384/bmj-2023-074819) — calibration, discrimination and validation terminology.
- [Cawley & Talbot (2010), selection bias from over-fitting model selection](https://www.jmlr.org/papers/v11/cawley10a.html).

## Shared gates before calling the project done

- [ ] No target leakage: LAD, LCX, RCA, Cath and derived CAD are absent from every model's inputs.
- [ ] Evaluation is reproducible; the held-out test set was not used for tuning; metrics and uncertainty are reported honestly.
- [ ] API response, feature/target configs, artery keys, mesh nodes and dashboard state agree.
- [ ] Prediction probabilities drive the same vessel colors in the 3D scene and result cards.
- [ ] SHAP output is labeled as model contribution, and clinical/3D claims stay within the README's stated limitations.
- [ ] Disclaimer is visible in the app, API response, report and demo.
- [ ] Dataset, mesh and library credits/licenses are recorded; no secrets or local environment folders are committed.
- [ ] Clean-clone setup and demo flow have been checked by someone other than the primary author.

## Team handoff and progress routine

For every task, keep a GitHub Issue or PR with:

1. **Owner and reviewer** (review buddies: M1↔M2 and M3↔M4).
2. **Status:** Not started → In progress → Blocked → In review → Ready.
3. **Acceptance check:** observable result that means the task is complete.
4. **Handoff note:** changed files, how to run/use them, inputs/outputs, assumptions, known limitations and next owner.

Use small area-based branches (`ml/...`, `api/...`, `3d/...`, `ui/...`) and merge reviewed work into `dev`; merge `dev` to `main` at milestones. Hold a short daily sync: done, next, blocker, handoff needed. Update the status tables after the sync and link the relevant issue/PR when available.

### Handoff note template

```text
Owner → next owner:
Status / PR or issue:
What is ready:
Files and run/use steps:
Inputs and outputs / contract:
Assumptions and limitations:
Next action:
```

## Decisions to confirm at kickoff

- [ ] Hackathon deadline, submission format and any required hosting/demo constraints.
- [ ] Team member names, GitHub handles and buddy reviewers.
- [ ] Dataset source/file and confirmed target-column mapping.
- [ ] API payload/response and shared artery config; freeze before parallel UI/3D integration.
- [ ] Python/Node versions and dependency pins for Windows and Mac.
- [ ] Who owns the shared `requirements.txt` change review and integration branch.
