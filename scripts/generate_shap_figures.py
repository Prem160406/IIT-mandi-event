"""Regenerate per-target global SHAP bar summaries from training records."""

from __future__ import annotations

from pathlib import Path
import sys

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.data_prep import build_xy, load_dataset
from ml.explain import _feature_origins, load_training_background
from sklearn.model_selection import train_test_split


MODEL_DIR = ROOT / "artifacts" / "baseline"
OUTPUT_DIR = ROOT / "frontend" / "public" / "figures"


def main() -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import shap

    frame = load_dataset()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for target in ("CAD", "LAD", "LCX", "RCA"):
        X, y = build_xy(frame, target)
        X_train, _, _, _ = train_test_split(X, y, test_size=0.20, random_state=2026, stratify=y)
        pipeline = joblib.load(MODEL_DIR / f"{target.lower()}_logistic.joblib")
        preprocessor = pipeline.named_steps["preprocess"]
        classifier = pipeline.named_steps["classifier"]
        transformed_train = preprocessor.transform(X_train)
        transformed_background = preprocessor.transform(load_training_background(target))
        if hasattr(transformed_train, "toarray"):
            transformed_train = transformed_train.toarray()
        if hasattr(transformed_background, "toarray"):
            transformed_background = transformed_background.toarray()
        transformed_train = np.asarray(transformed_train, dtype="float64")
        transformed_background = np.asarray(transformed_background, dtype="float64")
        explainer = shap.LinearExplainer(classifier, shap.maskers.Independent(transformed_background))
        explanation = explainer(transformed_train)
        origins = _feature_origins(preprocessor)
        feature_names = X_train.columns.tolist()
        grouped_values = np.zeros((len(transformed_train), len(feature_names)), dtype="float64")
        feature_indices = {name: index for index, name in enumerate(feature_names)}
        for column_index, feature in enumerate(origins):
            grouped_values[:, feature_indices[feature]] += np.asarray(explanation.values)[:, column_index]
        shap.summary_plot(
            grouped_values, feature_names=feature_names,
            plot_type="bar", max_display=15, show=False,
        )
        plt.title(f"{target} · mean absolute SHAP value (log-odds)")
        plt.tight_layout()
        plt.savefig(OUTPUT_DIR / f"global_shap_{target.lower()}.png", dpi=180, bbox_inches="tight")
        plt.close()
        print(f"Saved {OUTPUT_DIR / f'global_shap_{target.lower()}.png'}")


if __name__ == "__main__":
    main()
