"""FastAPI application for cardiovascular risk prediction and integration."""

from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config_loader import load_configs, load_features_config, load_metrics
from .explain_service import ExplanationService
from .predictor import Predictor
from .schemas import DISCLAIMER, HealthResponse, PredictRequest, PredictionResponse


@dataclass
class AppContainer:
    configs: dict[str, dict[str, Any]]
    predictor: Predictor
    explanation_service: ExplanationService


def _sample_features() -> list[dict[str, Any]]:
    """Small, editable demo inputs for M4; all values are public/made-up."""
    common = {
        "Sex": "Female",
        "DM": 0,
        "HTN": 0,
        "Current Smoker": 0,
        "EX-Smoker": 0,
        "FH": 0,
        "Obesity": "N",
        "CRF": "N",
        "CVA": "N",
        "Airway disease": "N",
        "Thyroid Disease": "N",
        "CHF": "N",
        "DLP": "N",
        "Edema": 0,
        "Weak Peripheral Pulse": "N",
        "Lung rales": "N",
        "Systolic Murmur": "N",
        "Diastolic Murmur": "N",
        "Typical Chest Pain": 0,
        "Dyspnea": "N",
        "Function Class": 0,
        "Atypical": "N",
        "Nonanginal": "N",
        "Exertional CP": "N",
        "LowTH Ang": "N",
        "Q Wave": 0,
        "St Elevation": 0,
        "St Depression": 0,
        "Tinversion": 0,
        "LVH": "N",
        "Poor R Progression": "N",
        "BBB": "N",
        "Region RWMA": 0,
        "VHD": "N",
    }
    low = {**common, "Age": 35, "Weight": 62, "Length": 168, "BMI": 22.0, "BP": 115, "PR": 68, "FBS": 88, "CR": 0.8, "TG": 110, "LDL": 90, "HDL": 58, "BUN": 14, "ESR": 8, "HB": 13.5, "K": 4.2, "Na": 139, "WBC": 6.0, "Lymph": 2.0, "Neut": 3.5, "PLT": 250, "EF-TTE": 65}
    lad = {**common, "Age": 58, "Weight": 82, "Length": 170, "BMI": 28.4, "BP": 145, "PR": 82, "HTN": 1, "DLP": "Y", "Typical Chest Pain": 1, "Dyspnea": "Y", "Function Class": 2, "Q Wave": 1, "Tinversion": 1, "FBS": 125, "CR": 1.0, "TG": 190, "LDL": 150, "HDL": 35, "BUN": 20, "ESR": 20, "HB": 13.0, "K": 4.4, "Na": 138, "WBC": 8.0, "Lymph": 2.1, "Neut": 5.0, "PLT": 240, "EF-TTE": 50, "Region RWMA": 1}
    multi = {**lad, "Age": 71, "Weight": 90, "BMI": 31.1, "BP": 165, "PR": 94, "DM": 1, "Current Smoker": 1, "FH": 1, "CHF": "Y", "CRF": "Y", "Typical Chest Pain": 1, "Dyspnea": "Y", "Function Class": 3, "St Depression": 1, "LVH": "Y", "Poor R Progression": "Y", "EF-TTE": 35, "Region RWMA": 3}
    return [
        {"id": "low-risk-demo", "label": "Low-risk demo", "description": "Younger patient with no recorded risk indicators.", "features": low},
        {"id": "single-vessel-lad-demo", "label": "Single-vessel LAD demo", "description": "Middle-aged patient with symptoms and metabolic risk factors.", "features": lad},
        {"id": "multi-vessel-demo", "label": "Multi-vessel demo", "description": "Older patient with multiple cardiovascular risk indicators.", "features": multi},
    ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    configs = load_configs()
    predictor = Predictor.from_artifacts(configs["arteries"])
    app.state.container = AppContainer(
        configs=configs,
        predictor=predictor,
        explanation_service=ExplanationService(predictor.models, configs["features"]),
    )
    yield
    app.state.container = None


app = FastAPI(
    title="Cardiovascular Risk Visualization API",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _container(request: Request) -> AppContainer:
    container = getattr(request.app.state, "container", None)
    if container is None:
        raise HTTPException(status_code=503, detail="Backend models are not loaded")
    return container


@app.get("/health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    container = _container(request)
    return HealthResponse(status="ok", loaded_models=list(container.predictor.models))


@app.get("/features")
def features() -> dict[str, Any]:
    return load_features_config()


@app.get("/samples")
def samples() -> dict[str, Any]:
    return {"samples": _sample_features()}


@app.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictRequest, request: Request) -> PredictionResponse:
    container = _container(request)
    try:
        result, prepared = container.predictor.predict(payload.features)
        explanations, groups = container.explanation_service.explain_all(prepared.frame)
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    result["explanations"] = explanations
    result["group_contributions"] = groups
    result["disclaimer"] = DISCLAIMER
    return PredictionResponse.model_validate(result)


@app.get("/metrics")
def metrics() -> dict[str, Any]:
    return load_metrics()
