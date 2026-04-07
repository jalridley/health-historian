# Frontend

Next.js (App Router) dashboard for HealthHistorian.

## Requirements

- Node.js 20+ (LTS recommended; match CI/hosting when you add it).

## Install

From repository root:

```bash
cd frontend
npm install
```

Dependencies are declared in `package.json` (including `babel-plugin-react-compiler` when React Compiler is enabled in `next.config.ts`).

## Development

```bash
npm run dev
```

App: `http://localhost:3000`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (CI-friendly) |

Tailwind class order is handled by `prettier-plugin-tailwindcss`.

## Environment

- Use `NEXT_PUBLIC_*` only for values safe in the browser.
- Keep API keys and backend secrets out of this app; call your FastAPI backend from server components or route handlers when you need privileged access.
