# HealthHistorian

Milestone 1 setup notes with manual terminal commands.

This project follows a learning-first flow:

- I provide commands
- You run commands manually
- We verify output before moving to the next step

## Milestone 1 Commands (Manual Run)

## 0) Verify Python Exists

Run in project root:

```bash
python3 --version
```

## 1) Backend Virtual Environment Setup

From project root:

```bash
mkdir -p backend && python3 -m venv backend/.venv
```

If you are already inside `backend/`, create the venv there:

```bash
python3 -m venv .venv
```

Activate and verify interpreter/pip paths:

```bash
source .venv/bin/activate && python -V && which python && pip -V
```

Expected path prefix:

- `/Users/jal/repos/startups/health-historian/backend/.venv/...`

## 2) Backend Dependency Installs (Explicit, One Step at a Time)

Install FastAPI:

```bash
pip install fastapi
```

Verify:

```bash
pip show fastapi
```

Install Uvicorn:

```bash
pip install "uvicorn[standard]"
```

Verify:

```bash
pip show uvicorn
```

Install test runner:

```bash
pip install pytest
```

Verify:

```bash
pip show pytest
```

Install HTTP client required by FastAPI TestClient:

```bash
pip install httpx
```

## 3) Backend App Scaffold

Create app folder:

```bash
mkdir -p app
```

Create `backend/app/main.py`:

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

Mark `app` as a package:

```bash
touch app/__init__.py
```

Run backend:

```bash
uvicorn app.main:app --reload
```

Verify backend health (from another terminal):

```bash
curl http://127.0.0.1:8000/health
```

## 4) Backend Test Checkpoint

Create tests folder:

```bash
mkdir -p tests
```

Create `backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

Create `backend/pytest.ini`:

```ini
[pytest]
pythonpath = .
testpaths = tests
```

Run tests:

```bash
pytest -q
```

## 5) Frontend Runtime Verification

From `frontend/`, run dev server:

```bash
npm run dev
```

If `reactCompiler: true` is enabled in `frontend/next.config.ts`, install required compiler package:

```bash
npm install -D babel-plugin-react-compiler
```

Verify frontend responds:

```bash
curl -I http://localhost:3000
```

Expected status line:

- `HTTP/1.1 200 OK`

## Notes

- Always confirm venv is active before `pip install`.
- Directory alone does not control install target; active interpreter does.
- Use `which python`, `which pip`, and `pip -V` before installs when unsure.
