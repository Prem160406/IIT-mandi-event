# Track A Roadmap: Cardiovascular Risk Visualization & Prediction

Multimodal AI Hackathon 2026 | Team of 4

This file is our single source of truth. It covers what the problem statement asks for, how we will build it, which tool is used for what, and who does which part. Keep it updated as we go.

> **Implementation status (2026-10-10):** This README describes the planned four-person product, not a claim that the full app is already implemented. M1 has an internal four-target logistic-regression baseline with leakage-safe training/evaluation and exact additive log-odds explanations; the helper is not SHAP. An M2 FastAPI backend implementation is staged on a mainline-based integration branch, but its runtime behavior and API contract still need team verification. The 3D viewer and dashboard remain integration work. See [`ROADMAP.md`](ROADMAP.md) and [`reports/m1_handoff.md`](reports/m1_handoff.md). This is not a clinically validated system.

---

## Table of Contents

1. [The project in simple words](#1-the-project-in-simple-words)
2. [Medical basics we need](#2-medical-basics-we-need)
3. [Requirements from the PS (checklist)](#3-requirements-from-the-ps-checklist)
4. [How we are judged and our plan for each criterion](#4-how-we-are-judged-and-our-plan-for-each-criterion)
5. [Dataset](#5-dataset)
6. [System architecture](#6-system-architecture)
7. [Tools and technologies (every tool explained)](#7-tools-and-technologies)
8. [Repository structure and file ownership](#8-repository-structure-and-file-ownership)
9. [ML pipeline in detail](#9-ml-pipeline-in-detail)
10. [Explainability (SHAP and LIME)](#10-explainability-shap-and-lime)
11. [Backend API](#11-backend-api)
12. [3D pipeline](#12-3d-pipeline)
13. [Dashboard and frontend](#13-dashboard-and-frontend)
14. [Integration contract](#14-integration-contract)
15. [Team split: 4 members](#15-team-split-4-members)
16. [Timeline and milestones](#16-timeline-and-milestones)
17. [Setup, Git workflow and running the project](#17-setup-git-workflow-and-running-the-project)
18. [Testing and QA](#18-testing-and-qa)
19. [Documentation and demo video plan](#19-documentation-and-demo-video-plan)
20. [Risks and backup plans](#20-risks-and-backup-plans)
21. [Final submission checklist](#21-final-submission-checklist)
22. [Stretch goals](#22-stretch-goals)
23. [Useful links](#23-useful-links)

---

## 1. The project in simple words

We build a web app. A user enters a patient's health data (age, blood pressure, cholesterol, ECG findings, echo findings and so on). A machine learning backend predicts:

- whether the patient has Coronary Artery Disease (CAD) overall, and
- whether each of the three main heart arteries (LAD, LCX, RCA) is narrowed.

A 3D heart on the screen then colors each artery (green for low risk, red for high risk) based on those predictions. The user can rotate, zoom and click an artery to see more detail. Next to the 3D view, a dashboard shows the predictions and explains why the model gave them (SHAP values), along with the patient's measurements and how much each one contributed.

Every page must clearly say that this is for decision support and education only, and is not a replacement for proper diagnostic imaging.

**One line summary:** patient data goes in, models predict, a 3D heart lights up, and the dashboard explains why.

---

## 2. Medical basics we need

| Term | Meaning |
|---|---|
| CAD (Coronary Artery Disease) | Plaque builds up in the arteries that feed the heart muscle and reduces blood flow. In this dataset it means at least 50% narrowing in one or more major arteries. |
| Stenosis | Narrowing of an artery. |
| LAD (Left Anterior Descending) | Runs down the front of the heart. Supplies the front of the left side. Often called the most critical artery. |
| LCX (Left Circumflex) | Wraps around the side and back of the heart. |
| RCA (Right Coronary Artery) | Supplies the right side and the bottom of the heart. |
| Cath | The result of the angiography (the actual test). It is basically the answer, so it must NOT be used as an input. |
| RWMA (Regional Wall Motion Abnormality) | An echo finding where a region of the heart wall moves abnormally. We use it as a normal input feature. It does NOT give an exact location of a blockage, so we must not claim it does. |
| ECG features | ST Elevation, ST Depression, T Inversion, Q Wave, LVH and so on. Signals read from the ECG. |
| Target leakage | When the model sees information that directly reveals the answer. That makes the scores look great but useless. |

Important note: the clinical features are model inputs only. They are not 3D coordinates. The mapping from a prediction to the 3D artery is just a color on a schematic artery.

---

## 3. Requirements from the PS (checklist)

This is every requirement in the PDF, broken down with how we meet it and who owns it. Owners: M1 = ML, M2 = Backend and integration, M3 = 3D, M4 = Frontend, docs and video.

### 3.1 Predictive modeling

| ID | Requirement from PS | How we meet it | Owner |
|---|---|---|---|
| R1 | Train classification models to predict overall CAD status | Current M1 baseline: raw logistic classifier; sigmoid calibration is retained as an experimental comparison and is not selected for app predictions | M1 |
| R2 | Predict stenosis status for LAD, LCX, RCA | Three more classifiers, one per vessel (4 models total) | M1 |
| R3 | Use demographic, clinical exam, ECG, lab and echo features | Use all available input columns, grouped by category | M1 |
| R4 | Exclude LAD, LCX, RCA and Cath from the input features | Hard-coded drop list in config, plus an automated test that fails if any of them appear in the feature list | M1 + M2 |
| R5 | Evaluate with accuracy, precision, recall, F1, ROC-AUC | Cross-validation plus a held-out test set, reported per target with confidence intervals | M1 |

### 3.2 3D visual mapping

| ID | Requirement | How we meet it | Owner |
|---|---|---|---|
| R6 | Render an interactive 3D torso/heart model (Three.js, WebGL, R3F or VTK.js) | React Three Fiber scene with a heart and arteries, plus a translucent torso if time allows | M3 |
| R7 | Dynamically color LAD, LCX, RCA nodes by predicted stenosis probability | Color scale driven by the probability from the API, updates on every new prediction | M3 |
| R8 | Rotate, zoom, select anatomical regions for vessel-specific detail | OrbitControls, click-to-select with raycasting, side panel with vessel detail | M3 + M4 |

### 3.3 Clinical dashboard

| ID | Requirement | How we meet it | Owner |
|---|---|---|---|
| R9 | Show predicted overall CAD status and vessel probabilities next to the 3D canvas | Split-screen layout: 3D on one side, result cards on the other | M4 |
| R10 | Interpretable breakdown of why (SHAP or LIME) | SHAP per prediction, shown as a bar chart for each target | M1 (compute) + M4 (display) |
| R11 | Show physiological measurements with their contribution to the prediction | Table of the patient's values, normal range, flag, and contribution bar | M4 |

### 3.4 Other requirements

| ID | Requirement | How we meet it | Owner |
|---|---|---|---|
| R12 | May use open-source mesh files (.obj/.gltf) | Heart mesh from BodyParts3D, Sketchfab (check license) or NIH 3D, cleaned in Blender and exported as .glb | M3 |
| R13 | Clear, visible disclaimer: decision support and educational only | Sticky top banner, footer text, and a note on every report and in the docs | M4 |

### 3.5 Technical considerations from the PS

| ID | Requirement | How we meet it | Owner |
|---|---|---|---|
| T1 | Responsive 3D in modern browsers without a dedicated GPU | Low-poly mesh (under about 100k triangles), render on demand, limited pixel ratio, test on integrated graphics | M3 |
| T2 | Architecture supports adding features, models, anatomical structures without a redesign | Config-driven design: feature list, targets and artery mapping all live in config files (see section 14) | M2 |
| T3 | Consistent correspondence between model outputs and displayed LAD/LCX/RCA | One shared artery config used by backend, 3D scene and dashboard, plus a test | M2 + M3 |

### 3.6 Deliverables

| Deliverable | What it is | Owner |
|---|---|---|
| Working software prototype | Web app with 3D viewer connected to the ML backend | All |
| Trained prediction pipeline | Clean code plus saved model weights for CAD and the 3 vessels | M1 |
| Clinical explanation dashboard | Prediction metrics, SHAP/LIME, patient breakdowns | M4 (+ M1 data) |
| Project documentation (max 6 pages) | Preprocessing, model architecture, 3D pipeline, usage, evaluation results | M4 compiles, everyone writes their part |
| Demo video (3 to 10 minutes, on YouTube) | Shows the working system, feature input workflow, 3D interactions and technical implementation | M4 records and edits, everyone appears or narrates their part |

---

## 4. How we are judged and our plan for each criterion

| Criterion | Weight | What judges want | Our plan |
|---|---|---|---|
| Predictive performance | 30% | Good metrics, good probability quality, proper validation | Stratified repeated CV, untouched test set, calibrated probabilities, confidence intervals, no leakage, honest reporting of weaker targets like LCX |
| 3D visualization | 25% | Anatomy that looks right, risk mapped spatially, interactive | Clean heart mesh with clearly separated LAD/LCX/RCA, smooth color mapping, hover and click, camera focus on a vessel, legend |
| Clinical interpretability | 20% | Good feature attribution, clear explanation, factor breakdown | SHAP per patient and global, features grouped by category, plain-language summary sentence, normal-range flags |
| System integration | 15% | Data pipeline, model and dashboard linked, real-time updates | One API call returns predictions and explanations, shared state in the frontend, optional live mode while editing inputs |
| Technical implementation | 10% | Architecture, code quality, reproducibility, public datasets and meshes | Clean repo, pinned requirements, one-command run scripts, fixed random seeds, credits for dataset and mesh |

Since the 3D and the ML are 55% together, we should not leave either for the last day.

---

## 5. Dataset

**Primary dataset:** Extension of Z-Alizadeh Sani dataset (UCI Machine Learning Repository, also on Kaggle and Mendeley Data).

- 303 patient records.
- Around 59 columns grouped as demographic, symptoms and examination, ECG, and laboratory plus echo features.
- The extension adds LAD, LCX and RCA columns on top of the original Z-Alizadeh Sani data.
- The dataset notes say that CAD is positive when at least one of the three arteries is stenotic, and that only one of LAD, LCX, RCA or Cath should be kept in the data for classification. The PS goes further and tells us to remove all of them from the inputs, which is the safest option.
- Load it quickly with:

```python
from ucimlrepo import fetch_ucirepo
ds = fetch_ucirepo(id=411)
X = ds.data.features
y = ds.data.targets
```

(Also keep a local copy of the .xlsx file in `data/raw/` so the project runs offline.)

### 5.1 Columns to expect

Check the real names with `df.columns` first, they can differ slightly (spaces, capitalisation). The usual groups are:

| Group | Typical columns |
|---|---|
| Demographic | Age, Weight, Length, Sex, BMI, DM, HTN, Current Smoker, EX-Smoker, FH, Obesity, CRF, CVA, Airway disease, Thyroid Disease, CHF, DLP |
| Symptoms and examination | BP, PR, Edema, Weak Peripheral Pulse, Lung rales, Systolic Murmur, Diastolic Murmur, Typical Chest Pain, Dyspnea, Function Class, Atypical, Nonanginal, Exertional CP, LowTH Ang |
| ECG | Q Wave, St Elevation, St Depression, Tinversion, LVH, Poor R Progression, BBB |
| Laboratory and echo | FBS, CR, TG, LDL, HDL, BUN, ESR, HB, K, Na, WBC, Lymph, Neut, PLT, EF-TTE, Region RWMA, VHD |
| Targets and labels | Cath (observed overall CAD label), LAD, LCX, RCA. The organizer workbook has no separate `CAD` column. |

M1 audited the organizer-provided workbook and confirmed `Cath` is the observed overall CAD label; the workbook has no separate `CAD` column. The one record where `Cath` disagrees with the vessel-derived rule is retained and documented for sensitivity analysis in `reports/data_audit.md` and `config/targets.yaml`.

### 5.2 Columns that must NEVER be inputs

`LAD`, `LCX`, `RCA`, `Cath` (as the PS says), and also the overall `CAD` label if it exists as a separate column, because it is derived from the vessels. This applies to all four models. For example, when predicting RCA, the LAD column must also not be used.

### 5.3 Things to check in the data

- Data types: many columns are text like Y/N, Male/Female, or N/Mild/Moderate/Severe. Convert them properly.
- Missing values and weird entries.
- Class balance for each of the 4 targets. The original data has far more CAD than normal patients, and LCX and RCA are probably more imbalanced than LAD. Print the counts.
- Units of lab columns (for example WBC and PLT may be stored in different scales). This matters for the normal-range display.
- Duplicate rows.
- Consistency: if the overall label says CAD but all three vessels are negative (or the reverse), investigate.

---

## 6. System architecture

```
+------------------+        +--------------------------+        +----------------------+
|  Dataset (xlsx)  | -----> |  Training pipeline       | -----> |  Saved artifacts     |
|  data/raw        |        |  (scikit-learn, XGBoost) |        |  models/*.joblib     |
+------------------+        |  CV, calibration, SHAP   |        |  metrics.json        |
                            +--------------------------+        +----------+-----------+
                                                                             |
                                                                             v
+----------------------+   JSON over HTTP   +---------------------------------------------+
|  React frontend      | <----------------> |  FastAPI backend                            |
|  - Input form        |   /predict         |  - validates input (Pydantic)               |
|  - Dashboard         |   /features        |  - loads models once at startup             |
|  - R3F 3D viewer     |   /metrics         |  - returns probabilities + SHAP values      |
|  - Zustand state     |   /samples         |  - reads config files                       |
+----------------------+                    +---------------------------------------------+
         ^
         |  loads
+----------------------+
|  heart.glb (mesh)    |
|  LAD / LCX / RCA     |
|  named nodes         |
+----------------------+
```

Flow of one prediction:

1. User fills the form (or picks a sample patient) and presses Predict.
2. Frontend sends the feature values as JSON to `POST /predict`.
3. Backend validates, runs preprocessing, runs 4 models, computes SHAP for each, and returns one JSON response.
4. Frontend stores the response in a shared state.
5. The 3D scene reads the vessel probabilities and recolors LAD, LCX and RCA. The dashboard reads the same state and draws the cards and SHAP charts.
6. Clicking an artery in 3D (or its card) sets the selected vessel, and both sides update.

---

## 7. Tools and technologies

For each tool: what it is, why we use it, where it is used, who owns it, and things to watch for. Pin versions in `requirements.txt` and `package.json` so everybody gets the same setup.

### 7.1 Languages and runtime

| Tool | Use | Notes |
|---|---|---|
| Python 3.10 or 3.11 | ML and backend | Everyone must use the same minor version. Avoid the newest release if a library (numba, shap) does not have wheels for it yet. |
| Node.js (current LTS) | Frontend build and tools | Comes with npm. Check with `node -v`. |
| TypeScript (optional) | Typed frontend | Good for catching API shape mistakes. If the team is new to it, plain JavaScript is fine. Decide on Day 1, do not switch later. |

### 7.2 ML and data tools (Owner: M1)

| Tool | Why we use it | Where | Watch out for |
|---|---|---|---|
| pandas | Load, clean and inspect the dataset | `ml/data_prep.py`, notebooks | Strip spaces in column names, check dtypes after encoding. |
| numpy | Array math | Everywhere | None. |
| scikit-learn | Pipelines, preprocessing, models, cross-validation, metrics, calibration | `ml/train.py` | Always put imputing, scaling and encoding inside a `Pipeline` so nothing leaks across CV folds. |
| XGBoost | Strong gradient boosting model for small tabular data, works with SHAP TreeExplainer | `ml/train.py` | Tune with small grids since data is tiny. Heavy tuning will overfit. |
| LightGBM (optional) | Another boosting model to compare | `ml/train.py` | With 303 rows it can overfit easily, use small trees. |
| Logistic Regression (in scikit-learn) | Simple, strong baseline, easy to explain | `ml/train.py` | Needs scaling. Often competitive on this dataset. |
| Random Forest (in scikit-learn) | Another comparison model | `ml/train.py` | Fine as a baseline. |
| imbalanced-learn (optional) | SMOTE or other resampling | `ml/train.py` | Only apply inside the CV pipeline (imblearn Pipeline). Class weights are simpler and usually enough. |
| SHAP | Per-patient and global feature attribution | `ml/explain.py` | Output shape differs between SHAP versions (list of arrays vs one array). Write one helper and test it. |
| LIME (optional) | Second opinion on explanations | `ml/explain.py` | Slower, and results vary between runs. Use only as a cross-check. |
| joblib | Save and load trained pipelines | `models/` | Load with the same scikit-learn and XGBoost versions used for training. |
| matplotlib and seaborn | Plots for the report: ROC, calibration, confusion matrix, SHAP summary | `reports/figures/` | Save at a good resolution since docs are limited to 6 pages. |
| Jupyter Notebook | EDA and experiments | `notebooks/` | Final training must be a plain script, not only a notebook, so it is reproducible. |
| PyYAML | Read config files | `ml/`, `backend/` | None. |

### 7.3 Backend tools (Owner: M2)

| Tool | Why | Where | Watch out for |
|---|---|---|---|
| FastAPI | Fast Python web framework, auto-generates API docs at `/docs` | `backend/app/main.py` | Load models once at startup, not per request. |
| Uvicorn | Server that runs FastAPI | Run command | Use `--reload` only in development. |
| Pydantic | Request and response validation | `backend/app/schemas.py` | Set min and max for each numeric field so nonsense input is rejected. |
| CORS middleware | Lets the frontend (different port) call the API | `main.py` | Allow the frontend origin, otherwise the browser blocks requests. |
| pytest | API and pipeline tests | `backend/tests/` | Add the leakage test and the config consistency test early. |
| httpx or requests | Calling the API in tests | tests | None. |
| Swagger UI (built in) | Try the API in the browser at `/docs` | Dev | Also good to show in the demo video briefly. |
| Postman or curl (optional) | Manual API testing | Dev | None. |
| Docker (optional) | One-command run on any machine | `Dockerfile`, `docker-compose.yml` | Windows needs Docker Desktop. Treat as bonus, not a requirement. |

### 7.4 3D tools (Owner: M3)

| Tool | Why | Where | Watch out for |
|---|---|---|---|
| Three.js | The WebGL engine underneath | Via R3F | Learn basic scene, camera, mesh, material, light first. |
| React Three Fiber (R3F) | Use Three.js as React components | `frontend/src/three/` | Do not create objects inside render loops. Use `useMemo` and refs. |
| @react-three/drei | Helpers: OrbitControls, useGLTF, Html labels, Environment, Stats, Bounds | `HeartScene.tsx` | `useGLTF` caches the model, use `useGLTF.preload`. |
| Blender | Clean, reduce, rename and export meshes | Offline | Name the objects exactly `LAD`, `LCX`, `RCA`, and apply transforms before export. |
| glTF/GLB format | Web-friendly 3D format | `public/models/heart.glb` | Keep the file small (a few MB). |
| glTF-Transform CLI or gltfpack (optional) | Compress and optimise the .glb | Offline | Only if the file is too big. Draco compression needs the decoder available to the browser. |
| BodyParts3D | Open anatomical meshes (.obj) from the Database Center for Life Science | Source of heart parts | Check the license and credit it. May not contain a good coronary tree. |
| Sketchfab (downloadable CC models) | Ready heart models, some with coronary arteries | Source | Check the license of the exact model, keep the attribution text. |
| NIH 3D | Another source of open meshes | Source | Check the license. |
| three.js `TubeGeometry` and `CatmullRomCurve3` | Build arteries ourselves as tubes if no mesh has them | `ProceduralArteries.tsx` | Needs manual tuning of the curve points so they sit on the heart surface. |
| Stats (from drei) | Show FPS while developing | Dev only | Remove from the final build. |

### 7.5 Frontend and dashboard tools (Owner: M4)

| Tool | Why | Where | Watch out for |
|---|---|---|---|
| Vite | Fast dev server and build tool | `frontend/` | Set the API base URL in an `.env` file. |
| React | UI framework | Whole frontend | Keep components small. |
| Tailwind CSS | Quick consistent styling | Whole UI | Pick a small color palette on Day 1 and stick to it. |
| Zustand | Small global state store (input, prediction, selected vessel) | `frontend/src/store/` | Both the 3D scene and the dashboard must read from this single store. |
| Recharts (or Chart.js) | SHAP bars, ROC curves, gauges | `components/` | Keep chart code in separate components. |
| axios or fetch | Call the API | `frontend/src/api/` | Handle loading and error states. |
| React Hook Form (optional) | Input form with validation | `InputForm.tsx` | Good for a form with 50 fields. |
| Figma or paper sketch (optional) | Layout planning | Day 1 | Do not spend more than a few hours here. |

### 7.5.1 Dev, docs and video tools (Owner: M4, shared)

| Tool | Why |
|---|---|
| Git and GitHub | Version control, PR reviews, issues for tasks |
| VS Code | Editor. Use the integrated PowerShell terminal on Windows |
| draw.io (diagrams.net) | Architecture and workflow diagrams for the report |
| Word, Google Docs or LaTeX | Writing the 6-page report, export to PDF |
| OBS Studio | Screen and mic recording for the demo video |
| A simple editor (DaVinci Resolve, Clipchamp, CapCut or similar) | Trimming and adding captions |
| YouTube | Hosting the video (must be viewable by the judges, so use public or unlisted and test the link in a private window) |

### 7.6 Optional hosting

| Tool | Use | Note |
|---|---|---|
| Vercel or Netlify | Host the frontend | Free tiers exist, check current limits. |
| Render, Railway or Hugging Face Spaces | Host the FastAPI backend | Free instances can sleep and have a slow first request. Never depend on them for the video. Record the demo locally. |

A hosted link is a bonus. A project that runs with a clear README is enough.

---

## 8. Repository structure and file ownership

Everyone owns specific folders. Do not edit another person's folder directly. Open a PR or ask them. This avoids merge conflicts.

```
cardiac-risk-3d/
├── README.md                     (M4, with inputs from all)
├── ROADMAP.md                    (this file, M4 keeps updated)
├── requirements.txt              (M1 + M2)
├── config/
│   ├── features.yaml             (M1: feature names, type, group, unit, normal range, min, max)
│   ├── targets.yaml              (M1: CAD, LAD, LCX, RCA, label column names)
│   └── arteries.json             (M2 + M3: artery key, label, mesh node name, color settings)
├── data/
│   ├── raw/                      (M1: original dataset file)
│   └── processed/                (M1: split files, saved test indices)
├── notebooks/                    (M1: EDA)
├── ml/                           (M1)
│   ├── data_prep.py
│   ├── train.py
│   ├── evaluate.py
│   ├── explain.py
│   └── utils.py
├── models/                       (M1: trained pipelines per target + metadata)
│   ├── cad/
│   ├── lad/
│   ├── lcx/
│   └── rca/
├── reports/
│   ├── metrics.json              (M1)
│   └── figures/                  (M1: ROC, calibration, SHAP summary)
├── backend/                      (M2)
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py
│   │   ├── predictor.py
│   │   ├── explain_service.py
│   │   └── config_loader.py
│   └── tests/
├── frontend/                     (M3 owns src/three, M4 owns the rest)
│   ├── public/models/heart.glb   (M3)
│   └── src/
│       ├── three/                (M3)
│       ├── components/           (M4)
│       ├── store/                (M4)
│       ├── api/                  (M4 + M2)
│       └── pages/                (M4)
├── scripts/
│   ├── run_dev.ps1               (M2, Windows)
│   ├── run_dev.sh                (M2, Mac/Linux)
│   └── train_all.ps1 / .sh       (M1)
├── docs/                         (M4)
│   ├── report.md or .docx
│   └── architecture.drawio
└── assets/                       (M3: Blender source files, mesh credits)
```

---

## 9. ML pipeline in detail

### 9.1 Steps

1. **Load and clean.** Read the file, strip column names, fix dtypes, map text categories to numbers or one-hot columns.
2. **Define targets.** Four binary targets: `CAD`, `LAD`, `LCX`, `RCA`. Convert labels like "Stenotic/Normal" or "Cad/Normal" to 1 and 0.
3. **Drop leakage columns** (section 5.2) from the input matrix. Do this in one function used by training AND by the API so they cannot disagree.
4. **Split.** Make a stratified train and test split (for example 80/20, fixed seed) before looking at any model results. Save the test indices. The test set is touched only once at the end.
5. **Preprocessing inside a Pipeline.**
   - Numeric columns: median imputer, then StandardScaler (needed for logistic regression, harmless for trees).
   - Binary and ordinal columns: most-frequent imputer.
   - Nominal categorical columns (like BBB, VHD): one-hot encoder with `handle_unknown="ignore"`.
   - Use `ColumnTransformer` and keep the output feature names so SHAP can show readable names.
6. **Models to compare** (per target): Logistic Regression, Random Forest, XGBoost, optionally LightGBM. Use `class_weight` or `scale_pos_weight` for imbalance.
7. **Validation.** Repeated stratified k-fold on the training part (for example 5 folds repeated 3 times). Tune hyperparameters with a small grid or random search inside the CV (use nested CV if time allows). Pick the best model per target by ROC-AUC, with F1 and recall as tie-breakers.
8. **Calibration.** Wrap the chosen model with `CalibratedClassifierCV` (sigmoid is safer than isotonic on 303 rows). The 3D colors depend on the probability, so it should be meaningful. Report the Brier score and a calibration plot.
9. **Threshold.** Default is 0.5, but for a screening-type tool recall matters. Choose a threshold from cross-validation (for example the one that gives recall of about 0.9, or the Youden index) and report metrics at both 0.5 and the chosen threshold. Store the threshold in the model metadata.
10. **Final test evaluation.** Run once on the held-out test set. Report accuracy, precision, recall, F1, ROC-AUC, confusion matrix, and a bootstrap confidence interval (for example 1000 resamples) for each target.
11. **Final model.** Retrain the chosen configuration on all data for deployment (say clearly in the docs that you did this after evaluation), and save it with joblib.
12. **Save artifacts** for each target: `model.joblib`, `metadata.json` (feature list, threshold, metrics, library versions, training date, random seed), and SHAP background data.

### 9.2 Handling the small dataset

- With 303 rows, a single train/test split is noisy. That is why repeated CV and confidence intervals matter. Judges are told to look at "validation methodology".
- Do not do feature selection on the full data before the CV. If you do selection, do it inside the pipeline.
- Do not tune on the test set. Not even once.
- Try a smaller feature set too (for example, features chosen by L1 logistic regression or by importance inside CV). A simpler model that scores the same is easier to explain. Mention it in the report even if it does not make it into the final system.
- Expect weaker results on LCX and RCA than on overall CAD. Papers on this dataset report fairly high scores for overall CAD, but vessel-level targets (especially LCX) are harder. Do not chase a number, and do not hide a weak result. Report it and explain why (fewer positive cases).

### 9.3 Making the outputs consistent

The dataset defines overall CAD as at least one stenotic vessel. So the overall probability should logically not be much lower than the highest vessel probability. Add a small check after prediction: if the CAD probability is lower than the max of the three vessel probabilities, show a note in the UI or log it. A simple option is to also display "P(at least one vessel stenotic)" derived from the vessel models as a cross-check. Discuss this in the docs.

### 9.4 Metrics table to fill (results section of the report)

| Target | Accuracy | Precision | Recall | F1 | ROC-AUC | Brier | Positives / Total |
|---|---|---|---|---|---|---|---|
| CAD | | | | | | | |
| LAD | | | | | | | |
| LCX | | | | | | | |
| RCA | | | | | | | |

Fill one table for CV (mean and std) and one for the held-out test set.

### 9.5 Reproducibility

- Fixed `random_state` everywhere.
- `scripts/train_all.ps1` and `train_all.sh` rebuild all models and metrics from raw data with one command.
- `metadata.json` stores the versions of the libraries.

---

## 10. Explainability (SHAP and LIME)

### 10.1 What we show

| View | Content |
|---|---|
| Per patient, per target | Top contributing features (say top 8): feature name, patient value, SHAP value, direction (raises or lowers risk) |
| Global importance | Mean absolute SHAP per feature, for each target (bar chart, saved as a figure for the report) |
| Grouped contribution | Sum of SHAP values per category (demographic, symptoms, ECG, lab, echo) so users see which group drove the risk |
| Plain-language line | A generated sentence like "Risk is raised mainly by age, T inversion and low EF-TTE" |
| Measurement table | Value, normal range, flag (low, normal, high), and its contribution bar |

### 10.2 How to compute (M1 writes the helper, M2 serves it)

- Tree models (XGBoost, Random Forest): `shap.TreeExplainer`. Fast enough for live use.
- Logistic Regression: `shap.LinearExplainer` (or the general `shap.Explainer`).
- Explain the underlying fitted model on the transformed features, then map feature names back to readable names. If the model is wrapped in `CalibratedClassifierCV`, explain the base estimator. The SHAP values are on the model's raw output scale (log-odds for many models), not exactly the calibrated probability, so label the chart as "contribution to the model score" and say that in the docs.
- One-hot columns: sum SHAP values of the pieces back to the original feature for display.
- Write one function `explain_one(target, row) -> list[dict]` and test that it works for all four targets with the SHAP version pinned.
- Save SHAP background data (a small sample of the training set) so the backend can recreate the explainer.

### 10.3 LIME (optional)

Use `lime.lime_tabular.LimeTabularExplainer` as a cross-check for a couple of patients in the docs. It is slower and random, so do not use it for the live dashboard.

---

## 11. Backend API

### 11.1 Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Quick check that the server and models are loaded |
| GET | `/features` | Feature schema (names, type, group, unit, min, max, default, normal range). The frontend builds the form from this, so adding a feature does not need frontend code changes. |
| GET | `/samples` | A few demo patients (low risk, single vessel, multi vessel) |
| POST | `/predict` | Takes feature values, returns probabilities, labels and explanations |
| GET | `/metrics` | Evaluation results from `reports/metrics.json` for the dashboard |

### 11.2 Example request

```json
{
  "features": {
    "Age": 58,
    "Sex": "Male",
    "BP": 140,
    "PR": 78,
    "LDL": 135,
    "HDL": 38,
    "EF-TTE": 45,
    "Tinversion": 1,
    "Region RWMA": 2
  }
}
```

Missing fields are allowed and handled by the imputer, but the response should say how many fields were missing so the user knows the prediction is less reliable.

### 11.3 Example response

```json
{
  "model_version": "1.0.0",
  "missing_fields": ["TG", "ESR"],
  "cad": {
    "probability": 0.81,
    "label": "CAD likely",
    "threshold": 0.45,
    "risk_level": "high"
  },
  "vessels": {
    "LAD": { "probability": 0.74, "risk_level": "high",     "threshold": 0.45 },
    "LCX": { "probability": 0.31, "risk_level": "low",      "threshold": 0.40 },
    "RCA": { "probability": 0.52, "risk_level": "moderate", "threshold": 0.42 }
  },
  "explanations": {
    "CAD": [
      { "feature": "Age", "value": 58, "shap": 0.42, "group": "Demographic" },
      { "feature": "EF-TTE", "value": 45, "shap": 0.38, "group": "Echo" }
    ],
    "LAD": [],
    "LCX": [],
    "RCA": []
  },
  "group_contributions": {
    "CAD": { "Demographic": 0.6, "Symptoms": 0.3, "ECG": 0.5, "Lab": 0.2, "Echo": 0.4 }
  },
  "disclaimer": "For decision support and educational purposes only. Not a substitute for formal diagnostic imaging."
}
```

### 11.4 Backend rules

- Load models, explainers and config once at startup.
- Validate every numeric field with a min and max from `features.yaml`.
- Use the same `drop_leakage_columns()` function as the ML code.
- Return clear error messages (HTTP 422 for bad input).
- Include the disclaimer text in the API response so every client shows it.
- Response time should feel instant. If SHAP is slow, cache the explainer objects.
- Never log patient data in a real deployment. For the hackathon, only use public dataset rows and made-up samples.

---

## 12. 3D pipeline

### 12.1 Getting the mesh

1. Try a downloadable heart model that already has separate coronary arteries (Sketchfab with a CC license, NIH 3D, or BodyParts3D parts). Write down the license and author for the credits slide and the report.
2. Open it in Blender. Check that LAD, LCX and RCA (or arteries that can be split) are separate objects.
3. If there is no usable artery mesh, use the backup (12.3).

### 12.2 Cleaning in Blender

1. Remove parts we do not need (extra organs, huge textures).
2. Reduce the polygon count with the Decimate modifier. Target under about 100k triangles in total, lower is better for machines without a dedicated GPU.
3. Fix scale and origin, then apply all transforms.
4. Rename the objects exactly: `Heart_Body`, `LAD`, `LCX`, `RCA` (and optionally `Torso`).
5. Give the artery meshes a simple material (we will override the color in code).
6. Export as glTF 2.0 binary (`.glb`) to `frontend/public/models/heart.glb`. Keep the file at a few MB. If it is larger, optimise it with glTF-Transform or gltfpack.
7. Save the `.blend` file in `assets/` so we can change it later.

### 12.3 Backup plan: build the arteries ourselves

If the mesh has no usable arteries:

- Use a plain heart surface mesh and draw each artery as a `TubeGeometry` following a `CatmullRomCurve3` through hand-picked points on the heart surface.
- Build a small debug mode (click on the heart to log the 3D point) so we can place the curve points quickly.
- LAD runs down the front, LCX curves around the left side to the back, RCA runs along the right side and bottom (see section 2).
- Say honestly in the docs that arteries are schematic.

### 12.4 The scene (React Three Fiber)

Components to build in `frontend/src/three/`:

| Component | Job |
|---|---|
| `HeartScene.tsx` | Canvas, camera, lights, controls, loads the model |
| `Artery.tsx` | One artery mesh: gets color from the probability, handles hover and click |
| `ProceduralArteries.tsx` | Backup tubes (only if needed) |
| `Torso.tsx` (optional) | Semi-transparent torso or ribcage so it reads as a "human anatomical model" |
| `RiskLegend.tsx` | Color legend (low, moderate, high) |
| `CameraRig.tsx` | Smooth camera move to the selected vessel and a reset-view button |
| `colorScale.ts` | Probability to color function |

### 12.5 Color mapping

- Probability to color by interpolating green, yellow, red.
- Risk levels (adjustable in config): low below 0.35, moderate 0.35 to 0.65, high above 0.65.
- Add a color-blind friendly option (for example blue to orange) as a toggle.
- Show the number on a label next to each artery (drei `Html`), and add a gentle pulse or glow for the high-risk ones.
- Before any prediction, show arteries in neutral grey so users do not read a color as a result.

```ts
// colorScale.ts (idea)
export function riskColor(p: number): string {
  const hue = 120 * (1 - Math.min(Math.max(p, 0), 1)); // 120 = green, 0 = red
  return `hsl(${hue}, 80%, 45%)`;
}
```

### 12.6 Interactions (R8)

- Rotate and zoom: drei `OrbitControls` with damping and min and max distance so users cannot get lost.
- Hover: highlight the artery and show a tooltip with name and probability.
- Click: select the artery. This sets `selectedVessel` in the store, the camera moves closer, and the side panel shows its detail and SHAP chart.
- Click the same card in the dashboard: the same selection happens in 3D (two-way link).
- Buttons: reset view, toggle torso, toggle labels, toggle heart transparency.

### 12.7 Performance (T1)

- `<Canvas dpr={[1, 1.5]}>` to limit pixel ratio.
- `frameloop="demand"` and call `invalidate()` when something changes, so the GPU is idle when nothing moves.
- No real-time shadows and no heavy post-processing.
- Reuse materials, do not recreate geometry on every render.
- Test on a laptop with integrated graphics and in a browser with hardware acceleration switched off. Aim for smooth interaction (30 fps or better).
- Use `useGLTF.preload` and show a loading indicator while the model loads.

---

## 13. Dashboard and frontend

### 13.1 Layout

```
+---------------------------------------------------------------------------+
| DISCLAIMER BANNER: Decision support / educational use only. Not a         |
| substitute for formal diagnostic imaging.                                 |
+---------------------------------------------------------------------------+
| Patient input (collapsible)   |            3D VIEWER                      |
|  - Sample patient dropdown    |   heart + LAD/LCX/RCA colored             |
|  - Grouped fields             |   [Reset] [Torso] [Labels] [Colorblind]   |
|  - [Predict]                  |   legend                                   |
+-------------------------------+-------------------------------------------+
| RESULT CARDS:  Overall CAD | LAD | LCX | RCA    (click to select)           |
+---------------------------------------------------------------------------+
| Tabs: [Explanation (SHAP)] [Measurements] [Model performance] [About]     |
|  - SHAP bar chart for selected target                                     |
|  - Group contribution chart                                               |
|  - Measurement table with normal range and contribution                   |
+---------------------------------------------------------------------------+
| Footer: dataset credit, mesh credit, disclaimer                           |
+---------------------------------------------------------------------------+
```

On small screens the panels stack vertically.

### 13.2 Components (M4)

| Component | Content |
|---|---|
| `DisclaimerBanner` | Always visible, cannot be dismissed permanently |
| `InputForm` | Built from `/features`. Grouped in accordions (Demographic, Symptoms, ECG, Lab, Echo). Number inputs with units and ranges, yes/no toggles, dropdowns. Sample patient loader. Reset button. |
| `ResultCards` | One card per target: probability, risk level, small gauge, click to select |
| `ShapChart` | Horizontal bars, red for features that raise risk and blue for those that lower it. Tabs for CAD, LAD, LCX, RCA. |
| `GroupContribution` | Bar or donut chart of contribution per category |
| `MeasurementTable` | Feature, value, unit, normal range, flag, contribution bar |
| `ModelPerformance` | Metrics table, ROC curves, calibration plot (images or charts from `/metrics`) |
| `AboutPanel` | Dataset, method summary, limits of the system, credits |
| `LoadingAndError` | Spinner and friendly error messages |

### 13.3 Reference ranges for the measurement table

These are general adult reference ranges for the display. Double-check them against a reliable source before final use, and confirm the dataset's units for each column first (some lab columns may use different scales than the ones shown here).

| Feature | Typical reference |
|---|---|
| BP (systolic) | about 90 to 120 mmHg |
| PR (pulse rate) | about 60 to 100 bpm |
| FBS (fasting blood sugar) | about 70 to 100 mg/dL |
| LDL | below about 100 mg/dL |
| HDL | above about 40 mg/dL (men), 50 mg/dL (women) |
| TG (triglycerides) | below about 150 mg/dL |
| CR (creatinine) | about 0.6 to 1.3 mg/dL |
| HB (hemoglobin) | about 12 to 17.5 g/dL |
| K (potassium) | about 3.5 to 5.0 mEq/L |
| Na (sodium) | about 135 to 145 mEq/L |
| EF-TTE (ejection fraction) | about 55% or higher |

Put these values in `features.yaml` so they are not hard-coded in the UI.

### 13.4 Live updates (integration criterion)

- "Predict" button for the normal flow.
- Optional "Live mode" toggle: when a value changes, wait about 300 ms (debounce), call the API, and the 3D colors and charts update smoothly. Great for the demo video.
- Smooth color transition (lerp the color over about half a second) so changes are visible.

### 13.5 Disclaimer text (use the same wording everywhere)

> This tool is for decision support and educational purposes only. It is not a medical device and is not a substitute for formal diagnostic imaging or professional medical judgment.

Place it in: the top banner, the footer, the About tab, the API response, the README, the report and the first and last seconds of the video.

---

## 14. Integration contract

This is how the pieces stay connected. Agree on it on Day 1 and freeze it.

### 14.1 Artery config (shared by backend, 3D and dashboard)

`config/arteries.json`:

```json
{
  "arteries": [
    { "key": "LAD", "label": "Left Anterior Descending", "meshNode": "LAD", "target": "LAD" },
    { "key": "LCX", "label": "Left Circumflex",          "meshNode": "LCX", "target": "LCX" },
    { "key": "RCA", "label": "Right Coronary Artery",    "meshNode": "RCA", "target": "RCA" }
  ],
  "riskLevels": { "low": 0.35, "high": 0.65 }
}
```

Rules:

- The API response keys, the mesh node names and the dashboard cards must all come from this file.
- A test checks that every artery key in the config exists in the API response and in the loaded `.glb` node names.

### 14.2 Mock API first

M2 provides a fake `/predict` response (same JSON shape as 11.3) on Day 1. The frontend and 3D work against it, so nobody waits for the real models. When the real models are ready, only the backend changes.

### 14.3 How to add things later (T2)

| Change | What to do |
|---|---|
| Add a clinical feature | Add it to `features.yaml`, retrain. The form, validation and SHAP display pick it up automatically. |
| Add a new model type | Add it to the model list in `train.py`. The winner is stored per target, the API does not change. |
| Add a new anatomical structure or vessel (for example Left Main) | Add a target in `targets.yaml`, add an entry in `arteries.json`, add a named node in the mesh. Train a model for it. |

Include this table in the docs. It answers the architecture requirement directly.

### 14.4 Shared state (frontend)

```
store = {
  input,            // current form values
  prediction,       // last API response (or null)
  selectedTarget,   // "CAD" | "LAD" | "LCX" | "RCA" | null
  status,           // "idle" | "loading" | "error" | "ready"
  settings          // colorblind, torso visible, labels visible, live mode
}
```

The 3D scene and the dashboard both read this. No separate copies of the data.

---

## 15. Team split: 4 members

Names to fill: M1 = ______, M2 = ______, M3 = ______, M4 = ______

The split is by area, with file ownership, so we do not step on each other. Each person also has one "buddy" for code review: M1 with M2, and M3 with M4. Everyone writes their own section of the report.

### Overview

| Member | Role | Main output |
|---|---|---|
| M1 | ML Lead | Data prep, 4 models, validation, SHAP helper, metrics, figures, model files |
| M2 | Backend and Integration Lead | FastAPI service, config system, API contract, tests, run scripts, wiring everything together |
| M3 | 3D Lead | Mesh pipeline, R3F scene, artery coloring, interactions, 3D performance |
| M4 | Frontend, Documentation and Video Lead | Dashboard UI, form, charts, disclaimer, README, report, demo video |

Rough load: M1 and M3 are heavy early, M2 is steady and heavy at the integration stage, M4 is steady on UI and heavy at the end on docs and video. M1 should pick up some documentation of the ML sections and help M4 with figures once models are done. M2 helps with docs and the video once integration is stable.

---

### M1: ML Lead

**Owns:** `ml/`, `models/`, `reports/`, `notebooks/`, `data/`, `config/features.yaml`, `config/targets.yaml`

**Tools to know well:** pandas, scikit-learn, XGBoost, SHAP, matplotlib, joblib, Jupyter

**Tasks**

| Phase | Task |
|---|---|
| Day 1 | Download the dataset, run EDA, confirm column names, label columns and class counts. Write `features.yaml` (name, type, group, unit, min, max, normal range) and `targets.yaml`. Build the leakage drop function. Create the stratified split and save the test indices. |
| Day 1 to 2 | Build the preprocessing pipeline. Train baseline models (logistic regression, random forest, XGBoost) for all 4 targets with repeated stratified CV. |
| Day 2 to 3 | Tune lightly, calibrate probabilities, choose the thresholds, evaluate on the held-out test set with confidence intervals. Save model files and `metadata.json`. |
| Day 2 to 3 | Write `explain.py`: SHAP for each model, mapping back to readable feature names, group contributions, generate the global SHAP figures. Hand the helper to M2. |
| Day 3 to 4 | Produce all figures for the report (ROC, calibration, confusion matrices, SHAP summary). Fill the metrics tables. Write `train_all` scripts so everything reruns from scratch. |
| Day 4 to 5 | Support M2 with model loading problems. Run the consistency check (CAD vs vessels). Write the ML sections of the report (dataset and preprocessing, model architecture, evaluation). |
| Later | Optional: LIME cross-check, smaller feature set comparison, ablation. |

**Hands over:**
- To M2: model files, `metadata.json`, `explain_one` function, `features.yaml`, `targets.yaml`.
- To M4: `reports/metrics.json` and figures.

**Needs from others:** M2 tells M1 if the model files are slow to load or the SHAP step is too slow.

**Definition of done:** one command retrains everything, metrics are saved, no leakage columns in any feature list, and every number in the report can be traced to a file.

---

### M2: Backend and Integration Lead

**Owns:** `backend/`, `config/arteries.json`, `scripts/`, `requirements.txt` (together with M1), CI or test setup

**Tools to know well:** FastAPI, Pydantic, Uvicorn, pytest, Swagger UI, Git workflow, (optional) Docker

**Tasks**

| Phase | Task |
|---|---|
| Day 1 | Set up the repo, branches and folder structure. Write the API contract (section 11 and 14) and a mock `/predict` that returns fake data in the final JSON shape. Set up CORS. Write `run_dev.ps1` and `run_dev.sh` that start the backend and frontend. Share the mock with M3 and M4. |
| Day 2 | Build the config loader that reads `features.yaml`, `targets.yaml`, `arteries.json`. Implement `/features`, `/samples`, `/health`. Pydantic schemas with ranges from the config. |
| Day 3 | Replace the mock with the real predictor: load the 4 models once, run preprocessing, return probabilities, risk levels and thresholds. Plug in SHAP from M1. Implement `/metrics`. |
| Day 3 to 4 | End-to-end integration with the frontend. Fix CORS, payload shape and speed issues. Add the consistency check and the missing-fields report. |
| Day 4 | Tests: leakage test, artery key consistency test, schema test, a smoke test on sample patients, a model sanity test. Optional Docker and hosting. |
| Day 5 | Bug triage, code cleanup, README run instructions. Help with the report sections on the API and system architecture and the architecture diagram. |

**Hands over:**
- To M3 and M4: mock API on Day 1, then the real API.
- To M4: the architecture diagram and API docs for the report.

**Needs from others:** M1 for model files and the SHAP helper, M3 for the mesh node names so the config matches.

**Definition of done:** a fresh clone runs with the documented steps, all tests pass, and the API response always matches the contract.

---

### M3: 3D Lead

**Owns:** `frontend/src/three/`, `frontend/public/models/`, `assets/`, `config/arteries.json` (together with M2)

**Tools to know well:** Three.js basics, React Three Fiber, drei, Blender, glTF format, browser dev tools (performance tab)

**Tasks**

| Phase | Task |
|---|---|
| Day 1 | Find and download candidate meshes (BodyParts3D, Sketchfab, NIH 3D). Check licenses and whether arteries are separate. Decide: real artery mesh or procedural tubes. Start a basic R3F scene that loads any heart model and rotates. |
| Day 1 to 2 | Clean the mesh in Blender: decimate, rename nodes to `Heart_Body`, `LAD`, `LCX`, `RCA`, export `.glb`. Confirm the node names with M2 for `arteries.json`. |
| Day 2 | Build `HeartScene`, `Artery` and `colorScale`. Color arteries from the mock API data. Add orbit controls, lighting, and the loading state. |
| Day 3 | Add hover and click selection, camera focus on the selected vessel, labels, legend, reset view and the toggles. Connect to the Zustand store from M4 (selection goes both ways). Smooth color transitions. |
| Day 3 to 4 | Performance work: pixel ratio, demand rendering, polygon budget. Test on integrated graphics and without hardware acceleration. Add the optional torso. |
| Day 4 to 5 | Polish: materials, glow on high risk, color-blind mode, neutral grey state before prediction. Write the 3D pipeline section of the report with screenshots and the mesh credits. |
| Later | Optional: myocardial territory overlay (clearly labelled as schematic), explode or cross-section view. |

**Hands over:**
- To M2: final node names for `arteries.json`.
- To M4: `HeartScene` component and the props or store fields it needs, screenshots for the report and video.

**Needs from others:** M4 for the shared store, M2 for the mock API.

**Definition of done:** smooth rotate, zoom and select on a normal laptop; colors always match the API probabilities; license credits recorded.

---

### M4: Frontend, Documentation and Video Lead

**Owns:** `frontend/` (everything except `src/three/`), `docs/`, `README.md`, `ROADMAP.md`, the demo video

**Tools to know well:** React, Vite, Tailwind, Zustand, Recharts, (optional) React Hook Form, draw.io, OBS Studio, a video editor

**Tasks**

| Phase | Task |
|---|---|
| Day 1 | Set up the Vite and React project, Tailwind, folder structure and Zustand store (shape in 14.4). Sketch the layout. Build `DisclaimerBanner` first. Connect to the mock API from M2. |
| Day 2 | Build `InputForm` from `/features`, grouped and validated, with the sample patient dropdown. Build the page layout with a placeholder where M3's 3D canvas goes. |
| Day 3 | Build `ResultCards`, `ShapChart`, `GroupContribution` and `MeasurementTable`. Wire selection to the store so the cards and 3D scene stay in sync. Add loading and error states. |
| Day 3 to 4 | Build `ModelPerformance` and `AboutPanel`. Add the live-mode toggle with debounce. Responsive layout. Final styling pass. |
| Day 4 | Write the README with a clear structure: what it is, features, setup for Windows and Mac, how to run, folder map, screenshots, credits and the disclaimer. Make a first draft of the 6-page report skeleton and collect everyone's sections. |
| Day 5 | Compile the report (keep it within 6 pages), diagrams in draw.io, figures from M1, screenshots from M3. Write the video script and storyboard. |
| Day 6 | Record and edit the demo video, upload to YouTube, test the link in a private window. |
| Day 7 | Final proofreading, checklist, submission. |

**Hands over:**
- To M3: the Zustand store and the layout slot for the canvas.
- To everyone: the report template with sections assigned.

**Needs from others:** M2 for the API, M3 for the 3D component, M1 for figures and metrics.

**Definition of done:** the full user flow works in the UI with no console errors, the disclaimer is visible on every screen, the report is within 6 pages, and the video is uploaded and viewable.

---

### Shared responsibilities

- 15 minute daily sync: what I finished, what I am doing, what blocks me.
- Every PR gets one review from the buddy before merging.
- Everyone writes their own report section (about half a page) and checks the final version.
- Everyone rehearses their part of the demo video.
- Everyone tests the final build on their own machine (some on Windows, at least one on Mac).

### Who covers whom (backup)

| If this person is stuck or absent | Backup |
|---|---|
| M1 (ML) | M2 can run the training scripts and use the saved models |
| M2 (Backend) | M1 can serve models with a simpler script, M4 knows the API shape |
| M3 (3D) | M4 can swap to the procedural-tube fallback scene |
| M4 (Frontend and docs) | M2 takes the video, M1 takes the report figures and ML sections |

---

## 16. Timeline and milestones

We do not know the exact hackathon length yet. Check the deadline, submission portal and format on Day 0, then stretch or compress this plan. The order of milestones stays the same.

| Day | Goal | Output |
|---|---|---|
| Day 0 | Kick-off | Repo created, roles confirmed, tools installed on every machine, deadline and submission format checked |
| Day 1 | Foundations | EDA and config files (M1), mock API (M2), mesh candidates and basic scene (M3), UI skeleton and store (M4). **Milestone M0: API contract frozen.** |
| Day 2 | Core pieces | Baseline models (M1), real config and schemas (M2), cleaned `.glb` (M3), input form (M4) |
| Day 3 | First end-to-end | Real models in the API, 3D colors from the real response, cards and SHAP chart. **Milestone M1: vertical slice works (enter data, see colored arteries and SHAP).** |
| Day 4 | Feature complete | All interactions, live mode, performance pass, tests. **Milestone M2: feature complete.** |
| Day 5 | Polish and docs | Final metrics, cleanup, report draft, bug fixing |
| Day 6 | Video and freeze | Demo video recorded and uploaded. **Milestone M3: code freeze** (only bug fixes after this). |
| Day 7 | Buffer and submit | Final tests on clean machines, proofreading, submission. **Milestone M4: submitted** |

If time is very short, protect these in order: (1) correct models with proper validation, (2) 3D arteries that change color and can be rotated and clicked, (3) SHAP dashboard and disclaimer, (4) docs and video, (5) everything else.

---

## 17. Setup, Git workflow and running the project

### 17.1 Windows setup (PowerShell in VS Code)

Backend and ML:

```powershell
git clone https://github.com/Prem160406/IIT-mandi-event.git
cd IIT-mandi-event
python -m venv .venv
.\.venv\Scripts\Activate.ps1
# If PowerShell blocks activation, use: .\.venv\Scripts\python.exe -m pip install -r requirements.txt
python -m pip install -r requirements.txt
python -m ml.data_audit
python -m ml.train_baseline
uvicorn backend.app.main:app --reload --port 8000
```

The ML audit and baseline commands are usable before the API exists. `ml.train_baseline` writes model files and `evaluation.json` under `artifacts/baseline/`; it does not tune against the holdout. The raw logistic models are uncalibrated; sigmoid-calibrated alternatives are saved as experiments and have not been selected for the app. These artifacts are committed for teammate handoff, but are not final model selections. Use Python 3.12 with the exact package versions in `requirements.txt` to reproduce this run; model files should be loaded only from this trusted repository and with the recorded scikit-learn version.

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Core frontend packages (for the first setup, M4):

```powershell
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install three @react-three/fiber @react-three/drei zustand recharts axios
npm install -D tailwindcss
```

### 17.2 Mac setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Frontend commands are the same as on Windows.

### 17.3 Team habits for a mixed Windows and Mac team

- Use forward slashes in code paths (or `pathlib`) so paths work on both.
- Keep line endings consistent (add a `.gitattributes` file if needed).
- Never commit `.venv/`, `node_modules/`, `__pycache__/` or `.env` files. Commit `.env.example`.
- Pin versions of scikit-learn, XGBoost and SHAP so the saved models load on every machine.
- Test the run scripts on both Windows and Mac before the freeze.

### 17.4 Git workflow

- `main`: always working, only merged after review. `dev`: integration branch.
- Feature branches named by area: `ml/calibration`, `api/predict`, `3d/artery-colors`, `ui/shap-chart`.
- Small commits with clear messages (for example `api: add /features endpoint`).
- Pull requests need one review from the buddy. Merge to `dev` daily, merge `dev` to `main` at each milestone.
- Use GitHub Issues or a simple board (To do, Doing, Done) for tasks. One issue per task in the tables above.
- Tag the final version as `v1.0` at submission.

---

## 18. Testing and QA

| Area | Tests |
|---|---|
| Data and ML | No leakage columns in any feature list. Split is stratified and reproducible. Metrics reproducible from the scripts. |
| Backend | Schema validation, out-of-range input returns 422, `/predict` works for every sample patient, response keys match `arteries.json`, response time is acceptable |
| Consistency | Every artery key exists in the API response, in the dashboard and as a node in the `.glb` |
| 3D | Colors match probabilities, selection works from both the 3D view and the cards, reset works, no console errors, smooth on integrated graphics |
| Frontend | Form validation, loading and error states, disclaimer visible on all screens, responsive layout |
| Browsers | Latest Chrome, Edge and Firefox (and Safari if someone has a Mac) |
| Clean install | A teammate who did not write the code clones the repo and follows the README exactly |

Demo patients to prepare (three contrasting cases): a low-risk patient (all arteries green), a single-vessel case (for example LAD red, others green), and a multi-vessel case (several arteries red). Pick real rows from the held-out test set where the model does well, and also keep one case where it is unsure, so we can talk honestly about limits.

---

## 19. Documentation and demo video plan

### 19.1 Report (max 6 pages)

| Page | Content | Writer |
|---|---|---|
| 1 | Problem, goal, overview of the system, architecture diagram | M4 + M2 |
| 2 | Dataset, preprocessing, leakage prevention, class balance | M1 |
| 3 | Model choices, validation method, calibration, thresholds | M1 |
| 4 | Results: metrics tables, ROC and calibration figures, SHAP summary, discussion of weaker targets | M1 |
| 5 | 3D pipeline (mesh source, cleaning, color mapping, interaction, performance), integration and live updates | M3 + M2 |
| 6 | Usage instructions, how to extend the system (table in 14.3), limitations, disclaimer, credits and references | M4 |

Tips: use figures sparingly (they eat space), use small clear tables, and keep one consistent font and style. Write in simple, direct language. Credit the dataset authors, the mesh source and all libraries.

### 19.2 README

Sections: project title and one-line summary, screenshot or GIF, features, tech stack, folder structure, setup for Windows and Mac, how to run, how to retrain, API overview, evaluation results summary, how to add features or vessels, limitations, credits and licenses, disclaimer.

### 19.3 Demo video (3 to 10 minutes, aim for about 6 to 7)

| Time | Content | Who speaks |
|---|---|---|
| 0:00 to 0:30 | Problem and goal, show the disclaimer | M4 |
| 0:30 to 1:30 | Architecture overview with the diagram | M2 |
| 1:30 to 2:45 | Data, leakage prevention, models, validation and results | M1 |
| 2:45 to 4:15 | Live demo: enter patient data, press Predict, show the artery colors changing, rotate, zoom, click LAD, show vessel details | M3 + M4 |
| 4:15 to 5:15 | Dashboard: SHAP explanation, group contributions, measurement table, live mode | M4 |
| 5:15 to 6:00 | 3D implementation and performance notes | M3 |
| 6:00 to 6:45 | How the system can be extended, limitations | M2 |
| 6:45 to 7:00 | Closing and disclaimer | M4 |

Video checklist: record locally (not from a free hosted site that may be asleep), 1080p, clear audio, close notifications, use a clean browser window, run the three demo patients in order, add captions if possible, upload to YouTube, and open the link in a private or incognito window to confirm it is viewable.

---

## 20. Risks and backup plans

| Risk | Impact | Backup |
|---|---|---|
| No good mesh with separate coronary arteries | 3D score suffers | Build arteries with `TubeGeometry` on a plain heart (12.3) |
| Mesh license problem | Disqualification risk or credit issue | Record license and author for every asset, prefer CC-BY or public domain, include credits in the UI and report |
| Heavy mesh slows the browser | Fails the "no dedicated GPU" requirement | Decimate in Blender, limit pixel ratio, demand rendering |
| Overfitting because the dataset is small | Inflated, unreliable metrics | Repeated CV, untouched test set, simple models, confidence intervals |
| Data leakage by accident | Invalid results | Single drop function plus an automated test |
| Poor LCX or RCA performance | Weak vessel-level results | Report honestly, show why (few positives), try class weights, simpler model, threshold tuning |
| Probabilities not calibrated | Misleading colors | Calibration step, calibration plot, risk thresholds in config |
| SHAP version or shape problems | Dashboard breaks | Pin the version, one helper function, a test per target |
| SHAP too slow | Laggy live mode | Tree explainers, cache explainers, only explain on Predict if needed |
| Integration problems at the end | Missing the demo | Mock API on Day 1, vertical slice by Day 3 |
| Windows vs Mac differences | "Works on my machine" | Pinned versions, run scripts for both, clean-clone test |
| Hosted free tier sleeping or slow | Demo fails | Record the video locally, provide local run steps |
| Team member unavailable | Delays | Backup table in section 15, daily sync, small tasks |
| Running out of time on docs and video | Lost points | Start the report skeleton on Day 4, code freeze before video recording |

---

## 21. Final submission checklist

**Software prototype**
- [ ] App runs from a clean clone with the README steps (Windows and Mac)
- [ ] 3D heart renders, rotates, zooms and selects LAD, LCX, RCA
- [ ] Artery colors update from predictions
- [ ] Dashboard shows CAD status and the three vessel probabilities beside the 3D view
- [ ] SHAP explanation, group contribution and measurement table work
- [ ] Disclaimer visible on every screen
- [ ] Live updates work
- [ ] No console errors in the final build

**Prediction pipeline**
- [ ] 4 models trained (CAD, LAD, LCX, RCA)
- [ ] LAD, LCX, RCA and Cath are excluded from all input features (test passes)
- [ ] Accuracy, precision, recall, F1, ROC-AUC reported with CV and held-out results
- [ ] Calibration and thresholds documented
- [ ] Model weights and metadata committed
- [ ] One command retrains everything

**Documentation**
- [ ] Report is 6 pages or less, exported to PDF
- [ ] Covers preprocessing, model architecture, 3D pipeline, usage, evaluation results
- [ ] README complete
- [ ] Dataset, mesh and library credits included
- [ ] Limitations section is honest

**Video**
- [ ] 3 to 10 minutes
- [ ] Shows the feature input workflow, 3D interactions, dashboard and technical implementation
- [ ] Uploaded to YouTube and the link works when logged out

**Repository**
- [ ] No secrets, no `.venv`, no `node_modules`
- [ ] Final tag `v1.0`
- [ ] Submission form filled and links tested

---

## 22. Stretch goals

Only after everything in section 21 is solid.

- Territory overlay: shade the heart region typically supplied by each artery, clearly labelled as a schematic and not a lesion map.
- "What-if" sliders: change one feature (for example LDL) and watch the risk change live.
- Compare two patients side by side.
- Export a one-page PDF report of the result with the disclaimer.
- LIME cross-check shown in the About tab.
- Ablation: performance with feature groups removed (for example without ECG).
- Docker Compose for one-command start.
- Hosted demo link.
- Uncertainty display (confidence interval on probabilities using bootstrapped models).

---

## 23. Useful links

- UCI dataset page: https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset
- Mendeley Data copy: https://data.mendeley.com/datasets/bgf5czvpg2
- BodyParts3D: Database Center for Life Science (search "BodyParts3D")
- Sketchfab: filter by "Downloadable" and check the license of each model
- NIH 3D Print Exchange: search for heart or coronary models
- Docs to keep open: scikit-learn, XGBoost, SHAP, FastAPI, Three.js, React Three Fiber and drei, Blender manual (Decimate modifier and glTF export)

---

*Disclaimer to keep in the project: This tool is for decision support and educational purposes only. It is not a medical device and is not a substitute for formal diagnostic imaging or professional medical judgment.*
