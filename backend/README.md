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
python -m pip install -r requirements.txt
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
- Copy [`.env.example`](.env.example) to `.env` and set at least:
  - `SUPABASE_JWKS_URL` — from your project: `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`
  - `SUPABASE_JWT_ISSUER` — must match the JWT `iss` claim: `https://<project-ref>.supabase.co/auth/v1` (no trailing slash after `v1` is typical; if verification fails, compare `iss` from a decoded token in [jwt.io](https://jwt.io) and align exactly).

FastAPI does not load `.env` automatically; export these in your shell before `uvicorn`, or use your IDE/host env injection. (Optional later: add `python-dotenv` and load on startup.)

## API (current)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Process liveness (`{"status":"ok"}`). Operational check, not clinical data. |
| GET | `/me` | Returns `sub` and `email` from a valid Supabase access token. Requires header `Authorization: Bearer <access_token>`. Returns `401` if missing/invalid/expired. |

### Manual check for `/me`

1. Log in via the Next.js app, obtain a short-lived access token (e.g. temporary `console.log` of `session.access_token` from Supabase, or your existing `getAccessToken()` helper during dev only).
2. With the API running and `.env` set:

```bash
curl -sS -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" http://127.0.0.1:8000/me
```

Expect JSON like `{"sub":"<uuid>","email":"you@example.com"}`.

OpenAPI docs (when server is running): `http://127.0.0.1:8000/docs` — open **GET /me**, click **Authorize**, enter only the JWT (no `Bearer ` prefix), then **Execute**.
