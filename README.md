# Frank Watson — Website

Official one-page site for Frank Watson (Belgian trance DJ & producer).
Plain static HTML/CSS served by a tiny **zero-dependency Node.js** server, ready to deploy on **Coolify** (or anything that runs Node or Docker).

## Project structure

```
frank-watson-web/
├─ public/            # the website (edit here)
│  ├─ index.html
│  ├─ hero.jpg        # logo artwork
│  └─ artist.jpg      # press photo
├─ server.js          # static file server (Node built-ins only, no npm deps)
├─ package.json       # start script + Node engine
├─ Dockerfile         # container build for Coolify
├─ .dockerignore
└─ .gitignore
```

## Run locally

```bash
npm start           # or: node server.js
# open http://localhost:3000
```

The server reads the port from the `PORT` environment variable (defaults to `3000`).
A health endpoint is available at `/health`.

## Deploy on Coolify

You can use **either** the Nixpacks buildpack **or** the Dockerfile.

### Option A — Dockerfile (recommended)
1. Push this folder to a Git repo (GitHub/GitLab/Gitea) — or use Coolify's "upload".
2. In Coolify: **+ New → Application** and select your repository.
3. **Build Pack:** `Dockerfile`.
4. **Port / Ports Exposes:** `3000`.
5. (Optional) **Health Check Path:** `/health`.
6. **Deploy.** Attach your domain (e.g. `frankwatson.be`) under the app's Domains — Coolify handles HTTPS via Let's Encrypt.

### Option B — Nixpacks (auto-detect)
1. Same steps 1–2 as above.
2. **Build Pack:** `Nixpacks` (Coolify detects `package.json`).
   - Install command: *(none needed — no dependencies)*
   - Start command: `npm start`
3. **Port:** `3000`.
4. **Deploy.**

### Environment variables
- `PORT` — injected automatically by Coolify. No other variables required.

## Editing the site
All content lives in `public/index.html`. Replace `public/hero.jpg` / `public/artist.jpg` to swap the logo or photo. No build step — changes are live on the next deploy.
