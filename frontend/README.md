# Frontend (React + React Three Fiber)

Single-page app: patient form, 3D heart, result cards, explanation, measurements, model metrics.
It talks to the FastAPI backend in `backend/` and reads `config/arteries.json` directly, so the
artery keys in the API, the dashboard and the 3D model cannot drift apart.

## Run

From the project root:

    # terminal 1 (API)
    python -m uvicorn backend.app.main:app --port 8000
    # terminal 2 (frontend)
    cd frontend && npm install && npm run dev      # http://localhost:5173

On Windows, double-click `start.bat` to open the API and frontend in separate windows; use `stop.bat` to close those windows. These BAT files track only the processes they started for this checkout. You can also run `scripts/run_all.sh` (Mac/Linux) or `scripts/run_all.ps1` (Windows) manually.
If the API is elsewhere, copy `.env.example` to `.env` and set `VITE_API_URL`.
Allowed browser origins are set in the backend (`ALLOWED_ORIGINS`, default `localhost:5173`).

## Checks

    npm run build     # type check + production build
    npm test          # colour-scale unit tests
    python -m pytest backend/tests -q   # includes the artery name check against heart.glb

## Layout

| Path | What |
|---|---|
| `src/store/useStore.ts` | The one shared store (input, prediction, selected artery, settings). 3D and dashboard both read it. |
| `src/api/client.ts` | `/health /features /samples /predict /metrics` calls with readable errors |
| `src/three/` | `HeartScene` (canvas), `HeartModel` (colours, picking, labels), `CameraRig` (fly-to, reset) |
| `src/lib/colorScale.ts` | probability to colour, green to red or blue to orange |
| `src/components/` | form, result cards, explanation, measurements, model performance, about |
| `public/models/heart.glb` | the 3D heart. Nodes: `Heart_Body`, `LAD`, `LCX`, `RCA` (+ invisible `*_pick` click targets) |

## Changing things

| Change | Do this |
|---|---|
| Add or rename an artery | Edit `config/arteries.json`, add a target in `config/targets.yaml`, add a mesh with the same name in the model. The backend test fails if they disagree. |
| Add a clinical feature | Add it to `config/features.yaml` and retrain. The form builds itself from `/features`. |
| Swap the 3D model | Replace `public/models/heart.glb`. Keep the node names. Optional click targets are named `LAD_pick` etc. |
