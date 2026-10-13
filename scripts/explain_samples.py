"""Print SHAP and exact centered log-odds explanations for the three API demos."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from scipy import sparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.config_loader import load_configs
from backend.app.explain_service import ExplanationService
from backend.app.main import _sample_features
from backend.app.predictor import Predictor
from ml.explain import (
    _feature_origins,
    exact_centered_attributions,
    load_training_background,
    verify_attribution_consistency,
)


def main() -> None:
    configs = load_configs()
    predictor = Predictor.from_artifacts(configs["arteries"])
    service = ExplanationService(predictor.models, configs["features"])
    for sample in _sample_features():
        row = predictor.prepare_input(sample["features"]).frame
        model = predictor.models["CAD"]
        background = load_training_background("CAD")
        preprocessor = model.named_steps["preprocess"]
        x = preprocessor.transform(row)
        reference = preprocessor.transform(background)
        if sparse.issparse(x):
            x = x.toarray()
        if sparse.issparse(reference):
            reference = reference.toarray()
        x = np.asarray(x, dtype="float64")
        reference = np.asarray(reference, dtype="float64")
        origins = _feature_origins(preprocessor)
        shap_result = service.explain_target("CAD", row, top_k=None)[0]
        shap_values = {item["feature"]: item["log_odds"] for item in shap_result}
        base_value, exact_values = exact_centered_attributions(
            model.named_steps["classifier"], x, reference, origins
        )
        verify_attribution_consistency(
            model.named_steps["classifier"], x, base_value, shap_values, exact_values
        )
        shap_top = sorted(shap_values.items(), key=lambda item: abs(item[1]), reverse=True)[:5]
        exact_top = sorted(exact_values.items(), key=lambda item: abs(item[1]), reverse=True)[:5]
        print(f"\n{sample['label']} · CAD · base={base_value:.6f} · log-odds={model.decision_function(row)[0]:.6f}")
        print("SHAP feature              SHAP value      Exact feature             Exact value")
        for (shap_feature, shap_value), (exact_feature, exact_value) in zip(shap_top, exact_top):
            print(f"{shap_feature[:24]:24} {shap_value:+.6f}      {exact_feature[:24]:24} {exact_value:+.6f}")
        print(f"Maximum SHAP/exact difference: {max(abs(shap_values[k] - exact_values[k]) for k in shap_values):.3g}")


if __name__ == "__main__":
    main()
