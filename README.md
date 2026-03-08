# MNEMOSYNE

Remote cognitive monitoring web application for dementia-adjacent clinical follow-up.

This system is for monitoring and decision support. It does **not** diagnose dementia.

## Goals

- Let patients complete cognitive and speech assessments remotely.
- Store longitudinal assessment data in PostgreSQL.
- Generate AI-assisted monitoring summaries from current + historical signals.
- Provide doctors a dashboard with patient trends, risk signals, and recent activity.

## Current Stack

### Frontend

- Vite
- React + TypeScript
- Tailwind CSS + shadcn/ui
- React Router
- React Query
- Recharts
- React Three Fiber / Drei / Three.js
- Auth0 (`@auth0/auth0-react`)

### Backend

- Node.js + Express (ESM)
- PostgreSQL (`pg`)
- Auth0 JWT validation (`express-oauth2-jwt-bearer`)
- ElevenLabs (TTS/STT routes)
- Google Gemini (monitoring summaries + drawing scoring)

## High-Level Features

- Patient assessment flow:
  - Word recall
  - Drawing tasks (clock + shape copies)
  - Memory challenge tasks
  - Spoken recall with transcription
- Auto-persistence of assessment payloads and derived per-test records.
- AI summary generation with fallback behavior when model calls fail.
- Doctor dashboard:
  - Patient list and risk levels
  - Trend summaries from stored sessions
  - Deep analysis endpoints for doctor workflows

## Project Layout

- `src/` frontend application
- `server/src/` backend API and persistence logic
- `public/` static assets and assessment vocab

## Environment Variables (Public-Safe)

Use `.env.example` files as templates. Do not commit real secrets.

### Frontend (`.env`)

- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`
- `VITE_API_BASE_URL`
- `VITE_FACE_MISSING_THRESHOLD_SECONDS`
- `VITE_STAGE3_REPEAT_SECONDS`
- `VITE_PRESAGE_DEV_MOCK`
- `VITE_PRESAGE_API_KEY`

### Backend (`server/.env`)

- `PORT`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_ROLES_NAMESPACE`
- `CLIENT_ORIGIN`
- `DATABASE_URL`
- `DATABASE_SSL_MODE`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_TIMEOUT_MS`
- `GEMINI_ENABLED`

## Local Setup

```sh
# from repo root
npm install
npm --prefix server install
```

Create local env files:

```sh
# PowerShell
Copy-Item .env.example .env
Copy-Item server/.env.example server/.env
```

Set your own credentials in `.env` and `server/.env`.

## Run the App

```sh
# Terminal 1 (frontend)
npm run dev

# Terminal 2 (backend)
npm run dev:api
```

Default local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`
- Health: `http://localhost:8787/health`

## Useful Commands

```sh
npm run lint
npm run test
npm run build
npm run preview
```

## API Surface (Main Routes)

Public:

- `GET /health`

Protected:

- `GET /api/me`
- `GET /api/doctor-only` (doctor role required)
- `POST /api/users/sync`
- `POST /api/assessment-attempts`
- `GET /api/assessment-attempts/me`
- `GET /api/doctor/dashboard` (doctor role required)
- `POST /api/assessment/:id/score-drawings` (doctor role required)
- `GET /api/doctor/patients/:patientId/deep-analysis/latest` (doctor role required)
- `POST /api/doctor/patients/:patientId/deep-analysis` (doctor role required)

## Public Repo Checklist

Before making this repository public:

- Remove any real secrets from `.env` and `server/.env`.
- Keep only placeholder values in `.env.example` files.
- Rotate keys that were ever committed by mistake.
- Verify CI/CD secrets are stored only in your hosting platform, not in git.

## Clinical Disclaimer

This software supports remote cognitive monitoring and trend review.
It is not a diagnostic tool and should not be used as a standalone basis for medical diagnosis.
