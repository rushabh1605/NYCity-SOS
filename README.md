# City SOS — Voice-First Safety Companion for NYC

> *"Built for anyone who's ever been in a room where they couldn't say the real thing out loud."*

City SOS is a real-time voice agent for New York City residents and university students. In normal use it answers safety and city-resource questions out loud. But when a user cannot speak freely, a single natural phrase flips the agent into a **permanent cover conversation** — it becomes a pizza order-taker — while it silently extracts location, headcount, and mobility details from the coded dialogue and dispatches a live alert to a monitored dispatch screen.

The person in the room hears someone ordering a large pepperoni. A dispatcher three windows away sees a red alert with a map pin, a stopwatch, and the full transcript.

**Built at:** AI Builder Day, NYU Tandon (GDG Brooklyn)
**Track:** Gemini Live Voice
**Model:** `gemini-3.1-flash-live-preview` (bidirectional audio streaming, function calling only)

---

## How It Works

### Normal Mode (default)
A calm, two-sentences-max assistant grounded in a hardcoded NYC + NYU Tandon resource set — campus public safety, crisis lines, nearest hospital, 311, cooling centers, NYC Well.

> *"What's the NYU Public Safety number?"* → *"NYU Public Safety is available 24/7 at 212-998-2222."*

### Cover Mode
Triggered when the user says any variation of **"I'd like to order a pizza."** The agent becomes Tony's Pizza in Brooklyn and **never exits** — not if the user asks it to, not if the danger appears to pass. The system prompt hard-bans the words *emergency, danger, help, police, 911, alert, safety* and forbids any "are you okay?" check-in. If it can't parse something, it responds with an ordinary order-taking clarification.

### The Coded Vocabulary
Ordinary order-taking questions gather everything a dispatcher needs, without sounding like anything:

| Cover phrase | Real meaning |
|---|---|
| "How many pizzas?" | Number of other people present |
| "Extra cheese" | User cannot move or leave |
| Delivery address | Actual location |
| **"Extra pineapple"** | **Trigger escalation now** |

### Silent Escalation
On the trigger phrase, Gemini Live calls the `trigger_escalation` function. The backend builds an alert payload and broadcasts it — while the agent says *"Extra pineapple, got it — that's gonna be about twenty-five minutes"* and keeps taking the order. No pause, no tone change, no acknowledgement.

The alert lands on the dispatch monitor: red banner, live stopwatch, Leaflet map pin, user profile, inferred situation summary, and the last ten transcript lines.

---

## Architecture

```
Browser mic ──PCM 16kHz──▶ FastAPI /ws/live ──WebSocket──▶ Gemini Live API
                                  │                            │
      audio out ◀───────────────  │  ◀──── audio + toolCall ───┘
                                  │
                          trigger_escalation
                                  │
                          AlertManager (pub/sub)
                              ╱        ╲
              SSE /api/alerts/stream   BroadcastChannel('city-sos-alerts')
                              ╲        ╱
                        Dispatch Monitor  /alert
```

The FastAPI server proxies the browser's microphone stream straight through to the Gemini Live bidirectional endpoint — audio in, audio out, no turn-based round trips. Interruptibility and sub-second latency are what make the cover conversation sound real in front of an observer.

Alerts fan out over two independent channels so the dispatch screen works whether it's a second browser window on the same machine (BroadcastChannel) or a separate device (Server-Sent Events).

### Routes

| Route | Purpose |
|---|---|
| `GET /` | Main UI — talk button, live transcript, campus selector. Add `?dev=1` for the mic-free simulation toolbar |
| `GET /alert` | Dispatch monitor — standby → alert states, map, stopwatch, transcript tail |
| `GET /health` | `{"status":"ok"}` |
| `GET /api/status` | Model name and API-key configuration check |
| `GET /api/alerts/stream` | SSE alert feed (replays the last alert to late subscribers) |
| `GET\|POST /api/alerts/trigger-demo` | Fires a mock alert for testing |
| `WS /ws/live` | Gemini Live audio proxy |

### Alert Payload (frozen contract)

```json
{
  "alert_id": "3f2b4c10-…",
  "timestamp": "2026-07-25T14:22:08.441Z",
  "user":     { "name": "…", "phone": "…", "campus": "NYU Tandon" },
  "location": { "lat": 40.6942, "lng": -73.9865, "label": "5 MetroTech Center, Brooklyn, NY 11201" },
  "situation_summary": "Caller indicates two other people present and is unable to leave the location.",
  "people_present": 2,
  "location_hint": "…",
  "urgency": "immediate",
  "transcript_tail": ["user: …", "agent: …"]
}
```

---

## Project Layout

```
NYCity-SOS/
├── city-sos/app/          # Integrated application (the one that runs)
│   ├── main.py            # FastAPI routes, WebSocket + SSE endpoints
│   ├── voice_engine.py    # Gemini Live session: audio pumps, tool-call handling
│   ├── system_prompt.py   # Normal mode, cover mode, coded vocabulary, resources
│   ├── tool_handler.py    # trigger_escalation declaration + AlertManager pub/sub
│   ├── config.py          # Model, API key, default user/location
│   ├── static/            # Main UI + dispatch monitor (HTML/CSS/JS)
│   └── integrations/      # voice_adapter.js — mic capture & audio playback
├── hiren/  nandani/  rushabh/   # Per-owner module directories (parallel dev)
├── Context/               # Original per-person hackathon briefs
├── run.py                 # Master entrypoint
├── app_assembly.py        # Alternate assembly wiring hiren/ + nandani/ modules
├── Dockerfile             # Cloud Run deployment
├── TEAM_INTEGRATION_GUIDE.md
└── DEMO_AND_TESTING_GUIDE.md
```

Each team member owned a top-level directory to avoid merge conflicts during the build window; `city-sos/` is the assembled result that ships.

**Team:** Hiren — voice/AI core · Nandani — dispatch alert screen · Rushabh — main UI, integration, deploy, demo

---

## Running It

### Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # then add your Gemini API key
```

`.env`:

```env
GEMINI_API_KEY=your_key_from_aistudio_google_com
GEMINI_MODEL=gemini-3.1-flash-live-preview
PORT=8000
```

### Start

```bash
python run.py
```

- Main UI — http://localhost:8000/
- Dispatch monitor — http://localhost:8000/alert
- Dev toolbar (no mic needed) — http://localhost:8000/?dev=1

Open the main UI and the dispatch monitor in two windows of the **same browser profile** so BroadcastChannel can reach both.

### Docker / Cloud Run

```bash
docker build -t city-sos:latest .
docker run -p 8000:8000 -e PORT=8000 city-sos:latest
```

```bash
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/city-sos:v1
gcloud run deploy city-sos \
  --image gcr.io/YOUR_GCP_PROJECT_ID/city-sos:v1 \
  --platform managed --region us-central1 \
  --allow-unauthenticated --port 8080
```

`git-push-deploy.sh` wraps pull → commit → push → Cloud Build → deploy in one command.

---

## Demo Walkthrough

1. Open the main UI on one screen, the dispatch monitor on the other (standby: `MONITORING — NO ACTIVE ALERTS`).
2. **Normal mode** — *"I need to reach NYU campus security."* → spoken answer with the real 24/7 number.
3. **The turn** — *"I'd like to order a pizza."* → status dot goes amber, agent becomes Tony's Pizza.
4. **Coded details** — *"Three, please. Extra cheese. Delivery to 5 MetroTech Center."*
5. **The trigger** — *"And extra pineapple on that."* → agent quotes a delivery time; the dispatch monitor goes red with the map pin, stopwatch, and transcript.

The `?dev=1` toolbar reproduces steps 3–5 without a microphone, for rehearsal or a noisy room. Full protocol and judge Q&A in `DEMO_AND_TESTING_GUIDE.md`.

---

## Design Notes & Limitations

- **Alerts go to pre-set trusted contacts, not directly to police.** In production this routes through a monitored dispatch center where a human verifies before emergency services are engaged — the model used by Noonlight and campus duress systems. That's the false-positive safeguard.
- **The pizza code is deliberately the well-known one.** The point isn't the specific phrase — it's that a human 911 operator can't be trained for every improvised code in real time, while an AI agent can hold the cover fiction *and* extract structured details simultaneously. The trigger phrase is user-configurable in principle.
- **Function calling only** on the Live session — no built-in tools or structured output alongside it, which is a known source of silent breakage. Temperature/topP/topK left at defaults.
- Resource data, user profile, and location are hardcoded for the demo. Real deployments would pull the NYC Emergency Management shelter feed, device geolocation, and an authenticated trusted-contact list.
- Volunteer matching via `gemini-embedding-2` (needs ↔ offers cosine similarity) was scoped but deprioritized against the escalation flow.
