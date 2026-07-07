# AGENTS.md

## Cursor Cloud specific instructions

Autobio is a mobile-first storytelling app with three independently runnable pieces:

| Service | Path | Run (dev) | Notes |
|---------|------|-----------|-------|
| Web app (React + Vite PWA) | `apps/web` | `npm run dev` (port 5173) | Primary product. Talks to the **real** Firebase project `autobio-b5dbf`. |
| Cloud Functions (TS) | `functions` | `npm run functions:build` then `npm run firebase:emulator` | Storage-triggered pipeline; only runs under the Firebase emulators. |
| Transcription worker (Python FastAPI / faster-whisper) | `services/transcription-worker` | `./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080` | Self-contained; no Firebase needed. |

Standard commands live in `package.json` (root + `apps/web` + `functions`); see README for the full list.

### Web app
- Requires `apps/web/.env` (gitignored) with the Firebase web config. The values are the public client config (also embedded in `.github/workflows/ci-cd.yml`, except `VITE_FIREBASE_API_KEY` which is the public web API key). If `apps/web/.env` is missing, recreate it via `npx firebase-tools apps:sdkconfig WEB --project autobio-b5dbf --token "$Firebase"` (the `Firebase` secret is a `firebase login:ci` token) and map the JSON fields to the `VITE_FIREBASE_*` variables.
- The client wires Firebase directly to production (no `connectAuthEmulator` etc.), so sign-up/login/Firestore/Storage actions hit the live `autobio-b5dbf` project. Use throwaway test accounts.
- `npm run lint` currently exits non-zero due to a pre-existing error (`'Link' is defined but never used` in `src/pages/LoginPage.tsx`) — not an environment problem.

### Transcription worker
- `huggingface_hub` must be `<1.0`: `faster-whisper==1.1.1` imports `requests`, which `huggingface_hub` 1.x dropped. The update script pins this after installing `requirements.txt`.
- First `/transcribe` downloads the Whisper model. Default `WHISPER_MODEL=small` (~460 MB); set `WHISPER_MODEL=tiny` for fast local checks.
- The worker's `httpx` client does **not** follow redirects, so `audio_url` must be a direct (non-redirecting) URL.
- `ffmpeg` is required (already present in the image) for decoding audio.

### Firebase emulators
- `npm run firebase:emulator` uses `npx firebase-tools` and Java (Java 21 is installed). Because the web client points at production, emulators are mainly useful for exercising Functions / Firestore / Storage rules, not the web UI.
