# City SOS — Voice-First Safety Companion

City SOS is a voice-first safety companion for New York City and university campuses. When users cannot speak freely in unsafe situations, City SOS seamlessly transitions into a permanent cover mode (Tony's Pizza order-taking assistant) while silently escalating exact location hints, transcript logs, and inferred details to preconfigured trusted contacts.

---

## Architecture & Routes

The application is served by Python FastAPI:

- `GET /` — Main City SOS User Interface (Talk button, transcript, campus selector, `?dev=1` toolbar)
- `GET /alert` — Nandani's Standalone Dispatch Monitor
- `GET /health` — Health check endpoint (`{"status":"ok"}`)

Inter-window communication between the main UI and the alert monitor uses the browser's native **`BroadcastChannel('city-sos-alerts')`** API across same-origin contexts.

---

## Local Development & Testing

### 1. Installation

```bash
cd city-sos
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Run Application

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Demo / Stage Walkthrough

1. Open **Main UI with Dev Controls**: `http://localhost:8000/?dev=1`
2. Open **Dispatch Monitor**: `http://localhost:8000/alert` (in a second window of the same browser profile)
3. Click **1. Simulate Pizza Request** → Subtle Cover Mode dot activates (Tony's Pizza).
4. Click **2. Simulate "Extra Pineapple"** → Silently posts frozen alert payload to `BroadcastChannel('city-sos-alerts')`.
5. Observe `/alert` window: Banner turns red (`ALERT DISPATCHED`), stopwatch timer starts counting up, user metadata, location map, and transcript tail update live.
6. Click **3. Simulate Follow-up Pizza Line** → Main UI continues pizza conversation naturally without showing emergency warnings.

---

## Docker & Google Cloud Run Deployment

### Build and Test Docker Container Locally

```bash
docker build -t city-sos:latest .
docker run -p 8000:8000 -e PORT=8000 city-sos:latest
```

### Deploy to Google Cloud Run

```bash
# 1. Set project ID
gcloud config set project YOUR_GCP_PROJECT_ID

# 2. Build image via Cloud Build
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/city-sos:v1

# 3. Deploy to Cloud Run
gcloud run deploy city-sos \
  --image gcr.io/YOUR_GCP_PROJECT_ID/city-sos:v1 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8000
```
