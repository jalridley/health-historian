# HealthHistorian

Personal and family medical record organizer with profile-scoped document uploads and AI-assisted retrieval (MVP in progress).

**Stack:** Next.js · FastAPI · Supabase (Auth + Postgres) · GCS (planned)

## Quickstart

```bash
git clone <repository-url>
cd health-historian
```

**Backend** — terminal 1:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in Supabase credentials
uvicorn app.main:app --reload
```

**Frontend** — terminal 2:

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in Supabase + API URL
npm run dev
```

- Backend: `http://127.0.0.1:8000` (`GET /health` for liveness)
- Frontend: `http://localhost:3000`

## Docs

- [Backend](backend/README.md) — API surface, database, auth, tests
- [Frontend](frontend/README.md) — dev server, scripts, environment
- [Architecture](docs/architecture-flow.md) — request flow diagram
