# Backend

FastAPI service for HealthHistorian (profiles, uploads, chat — as milestones land).

## Requirements

- Python 3.12+ recommended (project currently developed on 3.14).

## Install and run

From repository root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start the API (reload on code changes):

```bash
uvicorn app.main:app --reload
```

Default URL: `http://127.0.0.1:8000`

## Tests

```bash
pytest -q
```

Configuration: `pytest.ini` (test discovery and `pythonpath`).

## Environment

- Put secrets in `.env` or your host’s secret store; do not commit real credentials.
- Backend-only keys (database, storage, AI) must never be exposed to the browser.
- When `.env.example` exists, copy it to `.env` and fill values locally.

## API (current)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Process liveness (`{"status":"ok"}`). Operational check, not clinical data. |

OpenAPI docs (when server is running): `http://127.0.0.1:8000/docs`
