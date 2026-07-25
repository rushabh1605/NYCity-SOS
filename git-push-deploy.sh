#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "--------------------------------------------------"
echo "📥 STEP 0: Pulling latest changes from GitHub..."
echo "--------------------------------------------------"
git pull origin main

echo "--------------------------------------------------"
echo "🚀 STEP 1: Pushing changes to GitHub main branch..."
echo "--------------------------------------------------"
git push origin main

echo "--------------------------------------------------"
echo "🐳 STEP 2: Rebuilding container via Cloud Build..."
echo "--------------------------------------------------"
gcloud builds submit --tag gcr.io/nyu-ai-builder26nyc-9323/city-sos:latest --project=nyu-ai-builder26nyc-9323

# Load variables from local .env file
if [ -f .env ]; then
  echo "🔑 Loading environment variables from .env..."
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ Error: GEMINI_API_KEY is not set in environment or .env file."
  exit 1
fi

echo "--------------------------------------------------"
echo "☸️ STEP 3: Deploying container to Cloud Run..."
echo "--------------------------------------------------"
gcloud run deploy city-sos \
  --image gcr.io/nyu-ai-builder26nyc-9323/city-sos:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=${GEMINI_API_KEY},GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.1-flash-live-preview}" \
  --project=nyu-ai-builder26nyc-9323

echo "--------------------------------------------------"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "Live URL: https://city-sos-568594361079.us-central1.run.app"
echo "--------------------------------------------------"
