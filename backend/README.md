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

## Database stack

| Package | Role |
|---------|------|
| **SQLModel** | ORM + Pydantic-style models for `public.users` and `public.profiles` ([`app/models/`](app/models/)). |
| **Psycopg 3** (`psycopg[binary]`) | PostgreSQL driver; SQLAlchemy connects with `postgresql+psycopg://...`. |
| **pydantic-settings** | Loads config from `backend/.env` ([`app/core/config.py`](app/core/config.py)), including `DATABASE_URL`. |
| **Alembic** | Versioned schema migrations under [`alembic/versions/`](alembic/versions/). |

**Auth vs app tables:** Supabase owns sign-in in `auth.users`. The app mirrors signed-in users in `public.users` (`auth_user_id` → `auth.users.id`) and stores family profiles in `public.profiles`. Alembic uses a read-only metadata stub for `auth.users` ([`app/models/auth_schema.py`](app/models/auth_schema.py)) so foreign keys autogenerate correctly without managing the Auth schema.

### Layout

- [`app/models/`](app/models/) — SQLModel table definitions
- [`app/db/session.py`](app/db/session.py) — engine and `get_session()` for routes
- [`alembic/`](alembic/) — migration environment (`env.py` reads `DATABASE_URL` from settings)
- [`alembic/versions/`](alembic/versions/) — one file per schema revision

### Migrations (Alembic)

Run from `backend/` with the venv active and `.env` present. Use the **direct** Supabase Postgres URL (`db.<ref>.supabase.co:5432`), with scheme `postgresql+psycopg://` (see `.env.example`).

```bash
# After changing SQLModel models: generate a new revision (review the file before applying)
alembic revision --autogenerate -m "describe change"

# Apply pending migrations to Supabase
alembic upgrade head

# Show current revision on the database
alembic current
```

First migration: `8699142ccba4_create_users_and_profiles.py` creates `public.users` and `public.profiles`. Supabase **Table Editor** → schema **public** to inspect tables; `public.alembic_version` records the applied revision.

`psql` is optional; Alembic is the normal apply path. For ad-hoc SQL only, use `postgresql://` (no `+psycopg`) with the `psql` CLI.

## Environment

- Put secrets in `.env` or your host’s secret store; do not commit real credentials.
- Backend-only keys (database, storage, AI) must never be exposed to the browser.
- Copy [`.env.example`](.env.example) to `.env` and set at least:
  - `DATABASE_URL` — Supabase Postgres URI with `postgresql+psycopg://` (from dashboard **Connect** → direct connection; add `?sslmode=require` if not present)
  - `SUPABASE_JWKS_URL` — from your project: `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`
  - `SUPABASE_JWT_ISSUER` — must match the JWT `iss` claim: `https://<project-ref>.supabase.co/auth/v1` (no trailing slash after `v1` is typical; if verification fails, compare `iss` from a decoded token in [jwt.io](https://jwt.io) and align exactly).

`pydantic-settings` loads `.env` for Alembic and DB code. JWT verification in [`app/auth.py`](app/auth.py) still reads `SUPABASE_*` from the process environment for now — export vars in your shell before `uvicorn`, or rely on your IDE injecting `.env`. (Optional later: unify auth on `settings` and/or add `python-dotenv` at app startup.)

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
