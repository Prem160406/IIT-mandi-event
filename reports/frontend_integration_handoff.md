# Frontend and 3D integration handoff

## What was added

- `frontend/`: Vite, React, TypeScript, React Three Fiber, Zustand. Form built from `/features`, sample patients from `/samples`,
  four result cards (CAD, LAD, LCX, RCA), a 3D heart whose three arteries are recoloured from `vessels[key].probability`,
  per-target explanation (top 8 features and category totals), measurements table, model metrics from `/metrics`, About tab,
  disclaimer banner and footer. Live mode (300 ms debounce), colour-blind palette, labels, reset view, auto-rotate.
- `frontend/public/models/heart.glb`: procedural stylised heart. Named nodes `Heart_Body`, `LAD`, `LCX`, `RCA`.
- `backend/tests/test_artery_consistency.py`: every artery in `config/arteries.json` must exist in the API response and as a node in `heart.glb` (roadmap T3).
- `scripts/run_all.sh` and `scripts/run_all.ps1`: start the API and the frontend together.

No backend or ML code was changed.

## How it connects

form -> `POST /predict` -> `store.prediction` -> `riskColor(p)` -> `scene.getObjectByName(meshNode)`.
Clicking an artery in 3D or a card sets `selectedTarget` in the store; both sides update.

## Verified (in a headless browser against the real models)

- Backend: 6 tests pass (4 existing, 2 new). Frontend: build and 6 unit tests pass.
- Loading a sample patient calls the real API, recolours the arteries, fills the cards and explanation. A real mouse click on the 3D LAD selects it. No console errors.

Not verified: a real GPU, Windows and Mac browsers, phone browsers, frame rate on integrated graphics (roadmap T1).

## Things the team should decide

1. **Overconfident probabilities.** The API serves the raw logistic models. Demo samples return values like 0.9999999. The UI prints ">99%" and "<1%" for this reason. Calibrated models already exist in `artifacts/baseline/*_sigmoid_calibrated.joblib`, and the 3D colours depend on meaningful probabilities, so M1/M2 should consider serving them.
2. **Weak vessel results.** Held-out ROC-AUC is about 0.63 (LCX) and 0.64 (RCA) against 0.89 (CAD) and 0.79 (LAD), on 61 test patients. The Model performance tab shows this plainly. Say so in the report.
3. **Explanations are not SHAP.** They are exact log-odds terms of the logistic models (`ml/explain.py`). The UI says "contribution to the model score". The report should use the same wording.
4. **Two risk scales.** Pills and colours use 0.35 / 0.65 display bands from `arteries.json`; the "CAD likely" label uses 0.5. Both are display choices, not clinical thresholds.
5. **No reference ranges.** `config/features.yaml` has none yet, so the measurements table shows values and contributions only.
6. **Model size.** The glb has about 98k visible triangles (plus invisible click targets). Decimate or hide the thin cardiac veins if it is slow on weak hardware.
7. **Mesh credit.** The heart is procedural and schematic. Say so in the docs.
