# AGENTS.md

## Cursor Cloud specific instructions

Autobio is a monorepo with three components (see `README.md` for the full architecture):

| Component | Path | Stack | Run (dev) |
|-----------|------|-------|-----------|
| Web app (main product) | `apps/web` | React 19 + Vite PWA + Firebase | `npm run dev` (port 5173) |
| Cloud Functions | `functions` | TypeScript Firebase Functions | `npm run functions:build` (tsc); `npm run functions:serve` for emulator |
| Transcription worker | `services/transcription-worker` | Python FastAPI + faster-whisper | `.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080` |

Node deps (root + `apps/web` + `functions` workspaces) are installed by the update script via `npm install`. Python deps live in `services/transcription-worker/.venv` (also created by the update script). Standard scripts are in the root `package.json` (`dev`, `build`, `lint`, `functions:build`).

### Non-obvious caveats

- **Web app needs `apps/web/.env`, and the API key must be non-empty.** The file is gitignored, so it won't exist on a fresh VM. Create it with the public Firebase config below. Firebase `initializeApp` throws synchronously on an **empty** `VITE_FIREBASE_API_KEY`, which renders a **blank page** — any non-empty value lets the UI render. The non-secret values are public (also in `.github/workflows/ci-cd.yml`):
  ```
  VITE_FIREBASE_API_KEY=<real key, or any non-empty placeholder to just render UI>
  VITE_FIREBASE_AUTH_DOMAIN=autobio-b5dbf.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=autobio-b5dbf
  VITE_FIREBASE_STORAGE_BUCKET=autobio-b5dbf.firebasestorage.app
  VITE_FIREBASE_MESSAGING_SENDER_ID=1012550333400
  VITE_FIREBASE_APP_ID=1:1012550333400:web:727b3500b26968c9cff8ad
  VITE_FIREBASE_MEASUREMENT_ID=G-XDSHR161PL
  ```
- **Real auth / Firestore / Storage flows (signup, login, recording upload) require a valid `VITE_FIREBASE_API_KEY`** for project `autobio-b5dbf`. With a placeholder key the UI renders but signup fails with `auth/invalid-api-key`. The app code talks to **production** Firebase only — it does not wire up the Firebase emulators (no `connectAuthEmulator`/`connectFirestoreEmulator` calls), so running `firebase emulators:start` does not redirect the web app to local emulators.
- **`npm run lint` fails on pre-existing code** (`apps/web/src/pages/LoginPage.tsx` has an unused `Link` import). This is not an environment issue. Note CI (`lint-and-build` job) only runs `npm run build` and `npm run functions:build`, not `npm run lint`.
- **`requests` is required by the transcription worker** but was missing from `requirements.txt`. `faster-whisper==1.1.1` imports `requests` directly, and modern `huggingface_hub` no longer pulls it in transitively, so it is now pinned explicitly in `requirements.txt`.
- **Transcription worker model download:** the worker lazily downloads the Whisper model on the first `/transcribe` call. Set `WHISPER_MODEL=tiny` for fast local testing (default is `small`). The model is **not** loaded by `/health`.
- `firebase-tools` is **not** a dependency in any `package.json`; install it with `npm i -g firebase-tools` (or use `npx firebase-tools`) if you need emulators/deploy. Java is required for the Firestore/Storage emulators (Java 21 is preinstalled).
