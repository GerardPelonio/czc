# Deployment & Repo Layout (CozyClip Stories Backend)

This repository contains a backend under `Backend/` and root-level configuration for deployment (Vercel).

Key points:
- The backend application lives in `Backend/` with `package.json`, `server.js`, and all source code.
- The root `package.json` defines a simple workspace and the start script for local runs (or to help Vercel build).
- Use the root `vercel.json` to configure build/routing for Vercel; do NOT keep `Backend/vercel.json` around.
- Keep environment secrets out of the repo. Use Vercel dashboard or `vercel secrets`.

Local development:
1. Install dependencies and run from the backend:
```powershell
cd Backend
npm install
npm run dev
```
2. For Vercel local dev (simulates serverless):
```powershell
cd "<repo-root>"
vercel dev
```

Deployment
1. Ensure env variables are set on Vercel dashboard or via `vercel secrets`.
2. Deploy from repo root:
```powershell
vercel --prod
```

Cleaning the repo
- `.vercel/` contains local metadata and environment previews; do not commit this directory.
- Remove any `.env` or service account JSON files from the repo and rotate keys if they were committed.

If you need help automating a CI or adding `README` instructions to handle secret rotation and environment setup, let me know.
