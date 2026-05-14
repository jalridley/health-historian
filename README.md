# HealthHistorian

Personal and family medical record organizer: profile-scoped document uploads and AI-assisted retrieval (MVP in progress).

**Stack:** Next.js frontend, FastAPI backend, Postgres/Neon and GCS planned for later milestones.

## Quickstart

Clone the repository, then start backend and frontend in separate terminals.

```bash
git clone <repository-url>
cd health-historian
```

**Backend** (from repo root):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend** (from repo root):

```bash
cd frontend
npm install
npm run dev
```

- Backend API: `http://127.0.0.1:8000` — `GET /health` for liveness.
- Frontend: `http://localhost:3000`

## Documentation

- [Backend](backend/README.md) — dependencies, run, tests, environment, API surface.
- [Frontend](frontend/README.md) — dependencies, dev server, lint, formatting, environment.
- [Architecture Flow](docs/architecture-flow.md) — local frontend/backend request flow diagram.
