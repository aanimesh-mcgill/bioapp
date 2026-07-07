# AGENTS.md

## Cursor Cloud specific instructions

This is an npm-workspaces monorepo for **Autobio**. See `README.md` for the
architecture and the standard commands. Notes below are the non-obvious bits.

### Services
- `apps/web` — React + Vite PWA (the primary product). Dev server: `npm run dev` (root) → http://localhost:5173.
- `functions` — Firebase Cloud Functions (TypeScript). Build only: `npm run functions:build`.
- `services/transcription-worker` — optional Python/FastAPI faster-whisper service (runs on Cloud Run in prod).

### Web app config (required to run)
- The app has **no Firebase emulator wiring** in code — it talks to the **real**
  Firebase project `autobio-b5dbf` (Auth, Firestore, Storage all hit production).
  Email/password signup works out of the box.
- `apps/web/.env` is **gitignored** and not in the repo, so it must be recreated.
  The `Firebase` secret is a Firebase CLI token; regenerate the web config with:
  `firebase apps:sdkconfig WEB --project autobio-b5dbf --token "$Firebase"`
  and write the values into `apps/web/.env` using the `VITE_FIREBASE_*` keys from
  `.env.example`. Without this file, the dev server still boots but Auth/Firestore fail.

### Lint / build gotchas
- `npm run lint` exits non-zero out of the box due to a **pre-existing** error in
  `apps/web/src/pages/LoginPage.tsx` (unused `Link` import). This is a codebase
  issue, not an environment problem.
- `npm run build` (web) and `npm run functions:build` (tsc) both pass.

### Transcription worker (optional)
- Needs the `python3.12-venv` apt package and a venv at `services/transcription-worker/venv`.
- `requirements.txt` is **missing `requests`**, a transitive dep of
  faster-whisper 1.1.1; install it into the venv (`pip install requests`) or the
  server crashes on import.
- Run: `uvicorn main:app --port 8080` from the worker dir (activate venv first).
  `GET /health` returns immediately; the first `POST /transcribe` lazily downloads
  the Whisper model (slow, large).

### firebase-tools
- Installed globally via `sudo env "PATH=$PATH" npm install -g firebase-tools`
  (the npm global prefix is not user-writable). Needed for emulators and for
  `firebase apps:sdkconfig`.
