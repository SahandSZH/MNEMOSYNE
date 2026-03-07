# MNEMOSYNE - Full Stack Integration

This repository now contains:

1. `backend/` FastAPI service (assessment, speech, facial metrics, clock drawing, doctor/patient APIs)
2. `src/` Vite React frontend wired to backend endpoints

## Run Backend

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\alembic.exe -c alembic.ini upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Run Frontend

From repo root:

```powershell
npm install
npm run dev
```

Frontend runs on `http://127.0.0.1:5173`.

## Frontend Pages Wired to Backend

1. `/patient-test`:
   - `POST /assessment`
   - `POST /speech`
   - `POST /biometrics/facial`
   - `POST /clock-drawing`
2. `/doctor-dashboard`:
   - `GET /doctor/dashboard/{patient_id}`
3. `/patient-profile`:
   - `GET /patient/{id}`

## Environment Variables

Create a `.env` file for backend and frontend values.

Frontend (`Vite`) expected vars:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_AUTH0_DOMAIN=your-auth0-domain
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=https://dementia-monitoring-api
```

Backend vars are loaded from `backend/.env` via `pydantic-settings`.
