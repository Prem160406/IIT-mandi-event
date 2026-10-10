# M2 Backend Integration Handoff

**Checked:** 2026-10-10  
**Purpose:** Give the team a concise, reproducible account of how the backend branch was integrated, what is working, and what the next owners need to review.

## What happened

The backend arrived on `api/backend-integration` at commit `1f08df4` as a root commit with no shared ancestor with `main` (then `fda105b`). A normal merge therefore could not be used. A merge-tree preview showed one content conflict: both histories added `requirements.txt`. Before integrating, we checked that the API's configured 55 input features matched the `feature_names_in_` schema and order of each of the four saved model pipelines.

We created `api/backend-integration-mainline` from `main`, merged the backend history with unrelated histories, and resolved the dependency-file conflict by retaining the mainline's pinned ML dependencies while adding the backend's FastAPI, Uvicorn, Pydantic, pytest and HTTPX dependencies. The resulting merge commit `e2b888b` has `fda105b` and `1f08df4` as its parents. It was pushed to `origin`, and `main` was fast-forwarded and pushed to the same commit.

The original `api/backend-integration` branch remains intact at `1f08df4`. The integration branch `api/backend-integration-mainline` remains at `e2b888b`, the same commit as `main`. No branch was deleted.

## What the backend provides

The FastAPI service loads the four saved logistic-regression pipelines and their configuration at startup. It exposes:

- `GET /health` — model/service readiness.
- `GET /features` — input feature schema and metadata.
- `GET /samples` — sample inputs for a demo.
- `POST /predict` — CAD and LAD/LCX/RCA probabilities, risk bands, explanation contributions, missing-input information and disclaimer.
- `GET /metrics` — saved evaluation information.

The implementation is in `backend/app/`; the shared model features and artery mapping are configured under `config/`. The response schema is a draft until M3 and M4 confirm it meets their integration needs.

## Verification performed

Command from repository root in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/test_api.py -q
```

Result: **4 passed**. The tests exercise health/features endpoints, artery mapping, leakage filtering, and complete/partial prediction inputs. The test run emitted a Starlette deprecation warning about using HTTPX with `starlette.testclient` and recommending `httpx2`; it did not fail the tests.

The local `.venv` is ignored and was used only to install/run the test dependencies; no environment files or generated setup artifacts were committed. The first sandboxed TestClient attempt stalled because local socket operations were restricted in that execution context; rerunning with the permitted local test execution succeeded. This is a local verification, not yet a clean-clone/CI setup check.

## Next handoff actions

1. **M3 and M4:** review request/response field names, vessel keys, probability/risk semantics, explanation format, and loading/error cases. Record acceptance or requested changes before calling the contract frozen.
2. **M2:** verify the documented setup from a clean clone or CI runner, then address the HTTPX/Starlette deprecation warning with a compatible dependency choice.
3. **M2/M4:** restrict permissive CORS (`allow_origins=["*"]`) before any deployment; use the actual frontend origin(s).
4. **All:** agree whether the current illustrative risk cutoffs (`0.35`/`0.65` in `config/arteries.json`) are display-only demo bands. They are not clinically validated decision thresholds.
5. **M3/M4:** complete the end-to-end UI-to-API-to-3D flow and test that all views use the same vessel probability and artery mapping.

The service and models are a hackathon prototype. Passing API tests confirms software behavior covered by those tests; it does not establish clinical validity, external generalization, or deployment readiness.
