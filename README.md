# Autobio

Mobile-first web app for recording life stories, transcribing with open-source Whisper, and generating narrative drafts with a free LLM.

## Architecture

```
Mobile Web App (React + Vite PWA)
    ↓ record audio
Firebase Storage
    ↓ trigger
Cloud Function (processRecordingUpload)
    ↓ HTTP
Transcription Worker (faster-whisper on Cloud Run)
    ↓ transcript
Cloud Function → Story LLM (Groq/Ollama)
    ↓ draft
Firestore → App (edit & approve)
```

## MVP Flow

**Recording → Whisper transcription → editable story draft → buyer approval**

## Features

- Mobile-first UI with bottom navigation and touch-friendly controls
- Firebase Auth (email/password + Google)
- Audio recording in browser, uploaded to Firebase Storage
- Server-side transcription via [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (open-source Whisper)
- Multilingual support: English, Hindi (Devanagari), mixed Hindi-English
- Hindi output modes: keep in Devanagari, translate to English, or clean mixed speech
- Story draft generation via configurable LLM (Groq free tier by default)
- Buyer/admin approval workflow

## Project Structure

```
apps/web/                        React mobile web app
functions/                       Firebase Cloud Functions
services/transcription-worker/   Python faster-whisper API (Cloud Run)
.github/workflows/ci-cd.yml      CI/CD pipeline
```

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+ (for transcription worker)
- Firebase CLI: `npm install -g firebase-tools`

### Setup

```bash
npm install
cp .env.example apps/web/.env   # Firebase config already in apps/web/.env
firebase login
```

### Run web app

```bash
npm run dev
```

### Run transcription worker locally

```bash
cd services/transcription-worker
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### Run Firebase emulators

```bash
firebase emulators:start
```

## Deployment

### GitHub Secrets Required

| Secret / variable | Description |
|-------------------|-------------|
| `Firebase` (repo variable) or `FIREBASE_TOKEN` (secret) | CI token from `firebase login:ci` |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | For Cloud Run deploy (optional) |
| `GCP_SERVICE_ACCOUNT` | GCP service account email (optional) |

### Firebase Functions secrets

```bash
firebase functions:secrets:set TRANSCRIPTION_WORKER_URL
firebase functions:secrets:set LLM_API_KEY
```

Set `TRANSCRIPTION_WORKER_URL` to your Cloud Run URL after deploying the worker.

For free LLM, sign up at [Groq](https://console.groq.com/) and use model `llama-3.3-70b-versatile`.

### Manual deploy

```bash
npm run build
firebase deploy
```

### Deploy transcription worker

```bash
gcloud run deploy autobio-transcription \
  --source services/transcription-worker \
  --region us-central1 \
  --memory 2Gi --cpu 2 --timeout 600
```

## CI/CD

Push to `main` triggers:
1. Lint & build (web + functions)
2. Deploy Firebase Hosting, Functions, Firestore/Storage rules
3. Deploy transcription worker to Cloud Run (when GCP secrets configured)

## Firebase Project

- Project ID: `autobio-b5dbf`
- Repo: [github.com/aanimesh-mcgill/bioapp](https://github.com/aanimesh-mcgill/bioapp)

## License

MIT
