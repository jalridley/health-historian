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

All backend configuration (database, CORS, JWT verification) loads from `backend/.env` via [`app/core/config.py`](app/core/config.py) and [`settings`](app/core/config.py). Copy [`.env.example`](.env.example) to `.env` and set `DATABASE_URL`, `SUPABASE_JWKS_URL`, and `SUPABASE_JWT_ISSUER` before running `uvicorn` or Alembic.

## API (current)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Process liveness (`{"status":"ok"}`). Operational check, not clinical data. |
| GET | `/me` | Returns `sub` and `email` from a valid Supabase access token. Requires header `Authorization: Bearer <access_token>`. Returns `401` if missing/invalid/expired. |
| GET | `/profiles` | Lists profiles owned by the signed-in app user. Returns `200` + JSON array; `401` without a valid token. Creates `public.users` on first call if missing. |
| POST | `/profiles` | Creates a profile owned by the signed-in app user. Body: `display_name`, optional `is_self` (default `false`; only one self profile per user), optional `dob` (ISO date). Returns `201` + profile JSON; `401` without a valid token; `409` if a second self profile is requested; `422` on validation errors. `owner_user_id` is set server-side from the JWT — never send it in the body. |
| DELETE | `/profiles/{profile_id}` | Deletes an owned non-self profile. Returns `204`; `403` if `is_self`; `404` if not found or not owned; `401` without a valid token. |

CORS allows the frontend origin (`FRONTEND_ORIGIN`, default `http://localhost:3000`) so the Next.js app can call the API from the browser with `NEXT_PUBLIC_API_URL`.

### Manual check for `/me`

1. Log in via the Next.js app, obtain a short-lived access token (e.g. temporary `console.log` of `session.access_token` from Supabase, or your existing `getAccessToken()` helper during dev only).
2. With the API running and `.env` set:

```bash
curl -sS -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" http://127.0.0.1:8000/me
```

Expect JSON like `{"sub":"<uuid>","email":"you@example.com"}`.

OpenAPI docs (when server is running): `http://127.0.0.1:8000/docs` — open **GET /me**, click **Authorize**, enter only the JWT (no `Bearer ` prefix), then **Execute**.

### Manual check for `POST /profiles`

1. Sign up or log in via the Next.js app so `auth.users` has `user_metadata.first_name` / `last_name` (or use any display name for a family profile later).
2. Copy a short-lived access token (dev only: `session.access_token` from Supabase after login).
3. With the API running, `.env` set, and migrations applied:

```bash
curl -sS -X POST http://127.0.0.1:8000/profiles \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Jane Doe","is_self":true}'
```

Expect `201` with JSON including `id`, `display_name`, `is_self`, `dob`, `created_at`. Inspect `public.users` (row for your `auth_user_id`) and `public.profiles` (`owner_user_id` matches that user, `is_self` = `true` for your account profile).
