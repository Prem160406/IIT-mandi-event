"""Pydantic request and response schemas for the integration contract."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


DISCLAIMER = "For decision support and educational purposes only. Not a substitute for formal diagnostic imaging."


class PredictRequest(BaseModel):
    """A sparse feature mapping is accepted; omitted values are imputed."""

    model_config = ConfigDict(extra="forbid")
    features: dict[str, Any] = Field(default_factory=dict)


class CADStatus(BaseModel):
    probability: float = Field(ge=0.0, le=1.0)
    label: str
    threshold: float = Field(ge=0.0, le=1.0)
    risk_level: str


class VesselPrediction(BaseModel):
    probability: float = Field(ge=0.0, le=1.0)
    risk_level: str
    threshold: float = Field(ge=0.0, le=1.0)


class ExplanationItem(BaseModel):
    feature: str
    value: Any = None
    log_odds: float
    direction: str


class PredictionResponse(BaseModel):
    model_version: str
    missing_fields: list[str]
    cad: CADStatus
    vessels: dict[str, VesselPrediction]
    explanations: dict[str, list[ExplanationItem]]
    group_contributions: dict[str, dict[str, float]]
    disclaimer: str = DISCLAIMER


class HealthResponse(BaseModel):
    status: str
    loaded_models: list[str]
