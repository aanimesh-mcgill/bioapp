#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${1:-autobio-transcription}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
SOURCE_DIR="${CLOUD_RUN_SOURCE_DIR:-services/transcription-worker}"
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: gcloud CLI is required but not installed." >&2
  echo "Install it from https://cloud.google.com/sdk/docs/install and authenticate first." >&2
  exit 1
fi

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "Error: source directory '${SOURCE_DIR}' does not exist." >&2
  exit 1
fi

PROJECT_ARG=()
if [[ -n "${PROJECT_ID}" ]]; then
  PROJECT_ARG=(--project "${PROJECT_ID}")
fi

echo "Deploying Cloud Run service '${SERVICE_NAME}' from '${SOURCE_DIR}' in region '${REGION}'..."

gcloud run deploy "${SERVICE_NAME}" \
  --source "${SOURCE_DIR}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600 \
  --set-env-vars WHISPER_MODEL=small,WHISPER_DEVICE=cpu \
  "${PROJECT_ARG[@]}"

SERVICE_URL="$(
  gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --platform managed \
    --format='value(status.url)' \
    "${PROJECT_ARG[@]}"
)"

echo "Cloud Run service ready: ${SERVICE_URL}"
