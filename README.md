# Eukardia: 3D Cardiovascular Risk Visualization & Explainable Prediction

> **Disclaimer:** *This prototype is developed for educational, research, and demonstration purposes only. It is not clinically validated, is not a certified medical device, and must never be used for formal diagnosis, treatment planning, or clinical decision-making. Never input real identifiable patient health information.*

---

## Overview

**Eukardia** is a full-stack, multimodal clinical decision-support prototype that predicts coronary artery disease (CAD) and vessel-specific stenosis (LAD, LCX, RCA) from patient demographic, clinical, ECG, laboratory, and echocardiographic features.

Key capabilities include:
- **Interactive 3D Heart Visualization:** Schematic 3D anatomical heart (WebGL via React Three Fiber) with real-time risk-colored arteries (LAD, LCX, RCA), myocardial perfusion territory maps, anatomical landmark pins, and colorblind-accessible palettes.
- **Multitarget ML Risk Estimation:** 4 trained leakage-safe classification pipelines estimating overall CAD status along with individual branch stenosis for LAD, LCX, and RCA.
- **Explainable AI (XAI):** Closed-form linear SHAP explanations in log-odds space and physiological category aggregations (Demographic, Symptoms, ECG, Lab, Echo).
- **Comprehensive Clinical Dashboard:** Patient feature entry form, preloaded synthetic demo cases, physiological measurement flags against standard adult reference ranges, and exportable summary reports (Print to PDF / Word).

---

## Prerequisites & Dependencies

Before setting up the project, make sure the following are installed on your system:

| Prerequisite | Recommended Version | Purpose |
|---|---|---|
| **Python** | `3.10` – `3.12` (Python 3.12 recommended) | Backend FastAPI service & ML pipelines |
| **Node.js** | `v18.x` or newer (with `npm`) | Frontend React + Three.js application |
| **Git** | Recent version | Version control and repository management |

---

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/Prem160406/IIT-mandi-event.git
cd IIT-mandi-event
```

### 2. Backend Setup (Python)
Create and activate a virtual environment, then install the required dependencies:

**On Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

**On macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Frontend Setup (Node.js)
Install frontend dependencies using npm:
```bash
cd frontend
npm install
cd ..
```

---

## Running the Project

You can run both services together using the provided launcher scripts or run them manually in separate terminal windows.

### Method A: One-Click Launchers (Windows)
- **Start both servers:** Double-click `start.bat` or run:
  ```powershell
  .\start.bat
  ```
- **Stop all servers:** Double-click `stop.bat` or run:
  ```powershell
  .\stop.bat
  ```

---

### Method B: Manual Execution

#### Step 1: Start the Backend (FastAPI)
From the repository root with your virtual environment activated:
```bash
python -m uvicorn backend.app.main:app --reload --port 8000
```
- API will be accessible at: `http://localhost:8000`
- Interactive Swagger docs at: `http://localhost:8000/docs`

#### Step 2: Start the Frontend (Vite + React)
Open a new terminal window:
```bash
cd frontend
npm run dev
```
- Web application will be accessible at: `http://localhost:5173`

---

## Testing & Verification

Run the complete test suite to verify backend contracts, leakage safety, artery consistency, and frontend builds:

### Backend & ML Tests
```bash
# Run all backend unit and integration tests
python -m pytest backend/tests -v
```

### Frontend Checks
```bash
cd frontend
# Run frontend unit tests
npm test

# Verify production build compilation
npm run build
```

---

## API Overview

The FastAPI service exposes the following endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check verifying model loading and system readiness |
| `GET` | `/features` | Metadata schema for all 55 input features (types, units, valid ranges) |
| `GET` | `/samples` | Predefined synthetic patient cases (Low-Risk, Single-Vessel LAD, Multi-Vessel) |
| `POST` | `/predict` | Ingests patient features and returns CAD/artery probabilities and SHAP explanations |
| `GET` | `/metrics` | Holdout evaluation metrics and model validation figures |
| `GET` | `/docs` | Interactive OpenAPI / Swagger UI documentation |

---

## Project Structure

```text
IIT-mandi-event/
├── artifacts/              # Trained ML model pipelines (.joblib) and evaluation metadata
│   └── baseline/           # 4 logistic regression models (CAD, LAD, LCX, RCA)
├── backend/                # FastAPI backend service
│   ├── app/                # Main router, predictor, schemas, and explanation services
│   └── tests/              # Pytest test suites (API, leakage, explainability)
├── config/                 # Shared configuration files
│   ├── features.yaml       # 55 clinical feature definitions, types, and normal ranges
│   ├── targets.yaml        # Target definitions and leakage exclusion rules
│   └── arteries.json       # 3D mesh node mappings and risk thresholds
├── data/                   # Dataset storage
│   └── raw/                # Z-Alizadeh Sani source dataset
├── frontend/               # React + TypeScript + Three.js web application
│   ├── public/             # 3D assets (Heart2_Perfusion_Map.glb) and evaluation figures
│   └── src/
│       ├── components/     # UI widgets, assessment tables, disclaimers
│       ├── pages/          # Home, Input form, 3D Heart view, Report, About
│       ├── store/          # Zustand global state management
│       └── three/          # React Three Fiber 3D scene, materials, and camera rig
├── ml/                     # ML training, data audit, and SHAP explainability pipelines
├── reports/                # Model evaluation reports, baseline metrics, and data audit
├── scripts/                # Development, automation, and figure generation scripts
├── requirements.txt        # Pinned Python package dependencies
├── start.bat / stop.bat    # Windows server launchers
└── README.md               # Project documentation and run guide
```

---

## Model & Explainability Summary

- **Dataset:** Extension of Z-Alizadeh Sani dataset (UCI ID 411) consisting of 303 patient records across demographic, examination, ECG, laboratory, and echocardiographic features.
- **Leakage Prevention:** `Cath`, `CAD`, `LAD`, `LCX`, and `RCA` are strictly excluded from all training feature matrices.
- **Models:** 4 balanced, regularized logistic regression pipelines evaluated under repeated stratified 5-fold cross-validation with an untouched 20% holdout test set.
- **Attributions:** Closed-form linear SHAP explanations in log-odds space, aggregated by physiological category for clinician interpretability.

---

## License & Attribution

- **License:** Released under the [MIT License](LICENSE).
- **Dataset Attribution:** Extension of Z-Alizadeh Sani Dataset, UCI Machine Learning Repository.
- **3D Anatomical Heart Asset:** Custom schematic heart mesh with separate coronary tree and perfusion regions (`Heart2_Perfusion_Map.glb`).
