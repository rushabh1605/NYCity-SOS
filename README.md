# NYCity SOS — Voice-First Safety Companion

> *"Built for anyone who's ever been in a room where they couldn't say the real thing out loud."*

NYCity SOS is a real-time voice agent for New York City residents and university students. In normal use it answers safety and city-resource questions out loud. But when a user cannot speak freely, a single natural phrase flips the agent into a **permanent cover conversation** — it becomes a pizza order-taker — while it silently extracts location, headcount, and mobility details from the coded dialogue and dispatches a live alert to a monitored dispatch console.

The person in the room hears someone ordering a large pepperoni. A dispatcher three windows away sees a red alert card with a map, a stopwatch, and the full transcript.

**Built at:** AI Builder Day, NYU Tandon (GDG Brooklyn)
**Track:** Gemini Live Voice
**Model:** `gemini-3.1-flash-live-preview` (bidirectional audio streaming, function calling only)

---

## How It Works

### Normal Mode (default)
A calm, two-sentences-max assistant grounded in a hardcoded NYC + NYU Tandon resource set — campus public safety, crisis lines, nearest hospital, 311, cooling centers, NYC Well.

> *"What's the NYU Public Safety number?"* → *"NYU Public Safety is available 24/7 at 212-998-2222."*

### Cover Mode
Triggered when the user says any variation of **"I'd like to order a pizza"** or *"can I place an order."* The agent becomes Tony's Pizza in Brooklyn and **never exits** — not if the user asks it to, not if the danger appears to pass. The system prompt hard-bans the words *emergency, danger, help, police, 911, alert, safety* and forbids any "are you okay?" check-in. Replies are capped at one or two sentences, because a real order-taker is brisk, not chatty. If it can't parse something, it responds with an ordinary order-taking clarification.

### The Coded Vocabulary
Ordinary order-taking questions gather everything a dispatcher needs, without sounding like anything:

| Cover phrase | Real meaning |
|---|---|
| "How many pizzas?" / an explicit count | Number of other people present |
| "Extra cheese" | The user cannot move or leave |
| "Delivery" | The user is at home |
| "Pickup" | The user is elsewhere / in public |
| Delivery address | The user's actual location |
| **"Extra pineapple"** | **Trigger escalation now** |

### Silent Escalation
On the trigger phrase, Gemini Live calls the `trigger_escalation` function **exactly once per session** — the prompt enforces it, and the front end guards it with an `alertTriggered` latch so a repeated phrase can't fire duplicate cards. The backend builds an alert payload and broadcasts it, while the agent says *"Extra pineapple, got it — that's gonna be about twenty-five minutes"* and keeps taking the order. No pause, no tone change, no acknowledgement.

Two backstops make the payload trustworthy even when the model under-fills it:

- **Headcount inference** — if `people_present` comes back as `0`, `parse_people_count_from_transcript()` re-reads the transcript for explicit digits ("7 people", "4 large"), number words ("seven pizzas"), then any standalone number in a user line.
- **Location labelling** — a spoken address in `location_hint` overrides the default campus label on the alert card, so the dispatcher sees where the user actually said they were.

---

## Architecture

```
Browser mic ──PCM 16kHz──▶ FastAPI /ws/live ──WebSocket──▶ Gemini Live API
     │                            │                            │
webkitSpeechRecognition           │  ◀──── audio + toolCall ───┘
 (live user transcript)     audio out ─▶ browser
                                  │
                          trigger_escalation
                                  │
                          AlertManager (pub/sub, up to 10 active)
                              ╱        ╲
              SSE /api/alerts/stream   BroadcastChannel('city-sos-alerts')
                              ╲        ╱
                        Dispatch Console  /alert
```

The FastAPI server proxies the browser's microphone stream straight through to the Gemini Live bidirectional endpoint — audio in, audio out, no turn-based round trips. Interruptibility and sub-second latency are what make the cover conversation sound real in front of an observer.

Gemini Live returns the agent's audio but not a user-side transcript, so the browser runs `webkitSpeechRecognition` continuously alongside the audio stream. That gives a real spoken transcript in the UI and, more importantly, real transcript lines attached to the alert — not a canned script.

Alerts fan out over two independent channels so the dispatch console works whether it's a second browser window on the same machine (BroadcastChannel) or a separate device (Server-Sent Events).

### Routes

| Route | Purpose |
|---|---|
| `GET /` | Main UI — talk button, live transcript, campus selector, session reset. `?dev=1` adds the mic-free simulation toolbar |
| `GET /alert` | Dispatch console — radar standby, multi-alert cards, dismiss/clear controls |
| `GET /health` | `{"status":"ok"}` |
| `GET /api/status` | Model, API-key configuration, and active alert count |
| `GET /api/alerts/stream` | SSE feed — replays all active alerts to new subscribers |
| `GET\|POST /api/alerts/trigger-demo` | Fires a mock alert |
| `GET\|POST /api/alerts/clear` | Clears every active alert |
| `POST /api/alerts/dismiss/{alert_id}` | Dismisses one alert card |
| `WS /ws/live` | Gemini Live audio proxy |

### Event Envelope

`AlertManager` keeps a rolling list of up to ten active alerts and pushes an action-tagged envelope to every subscriber:

```json
{ "action": "new_alert", "alert": { … }, "all_alerts": [ … ] }
```

Actions: `initial_state` (sent on connect), `new_alert`, `dismiss_alert`, `clear_all`. The console rebuilds from `all_alerts` on the state-level actions and appends on `new_alert`, so a dispatcher joining mid-incident sees the same board as everyone else.

### Alert Payload

```json
{
  "alert_id": "3f2b4c10-…",
  "timestamp": "2026-07-25T14:22:08.441Z",
  "user":     { "name": "…", "phone": "…", "campus": "NYU Tandon" },
  "location": { "lat": 40.6942, "lng": -73.9865, "label": "5 MetroTech Center, Brooklyn, NY 11201" },
  "situation_summary": "Caller indicates 7 people present, unable to leave, requested delivery to location.",
  "people_present": 7,
  "location_hint": "5 MetroTech Center",
  "urgency": "immediate",
  "transcript_tail": ["user: …", "agent: …"]
}
```

---

## The Dispatch Console

Built as a product, not a debug view — something a dispatcher could stare at during a shift.

- **Standby** — sweeping radar, `MONITORING — NO ACTIVE ALERTS`, and a self-serve beacon simulator. Idle is a designed state, not a blank page.
- **Multi-alert board** — every incident renders as its own card with an active-count badge in the banner. Alerts stack; they don't overwrite each other.
- **Live stopwatch** — counts up from the dispatch timestamp. Elapsed time is the first thing a responder asks.
- **Inline vector map** — a self-contained SVG street schematic with a location badge. No tile server, no network dependency, nothing to fail on venue Wi-Fi.
- **Transcript tail** — the real spoken lines, so a human can verify before acting.
- **Dismiss / Clear All** — per-card dismissal and a full reset, both propagated to every connected console.

---

## Project Layout

```
NYCity-SOS/
├── city-sos/app/          # Integrated application (the one that runs)
│   ├── main.py            # FastAPI routes, WebSocket + SSE endpoints
│   ├── voice_engine.py    # Gemini Live session: audio pumps, tool-call handling
│   ├── system_prompt.py   # Normal mode, cover mode, code mapping, resources
│   ├── tool_handler.py    # trigger_escalation, AlertManager, headcount inference
│   ├── config.py          # Model, API key, default user/location
│   ├── static/            # Main UI + dispatch console (HTML/CSS/JS)
│   └── integrations/      # voice_adapter.js — mic capture, playback, speech recognition
├── hiren/  nandani/  rushabh/   # Per-owner module directories (parallel dev)
├── Context/               # Original per-person hackathon briefs
├── run.py                 # Master entrypoint
├── app_assembly.py        # Alternate assembly wiring hiren/ + nandani/ modules
├── Dockerfile             # Cloud Run deployment
├── git-push-deploy.sh     # Pull → commit → push → build → deploy, one command
├── TEAM_INTEGRATION_GUIDE.md
└── DEMO_AND_TESTING_GUIDE.md
```

Each team member owned a top-level directory to avoid merge conflicts during the build window; `city-sos/` is the assembled result that ships.

**Team:** Hiren · Nandani · Rushabh

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
- Dispatch console — http://localhost:8000/alert
- Dev toolbar (no mic needed) — http://localhost:8000/?dev=1

Open the main UI and the dispatch console in two windows of the **same browser profile** so BroadcastChannel can reach both. Use Chrome — `webkitSpeechRecognition` is what produces the live user transcript.

### Docker / Cloud Run

```bash
docker build -t nycity-sos:latest .
docker run -p 8000:8000 -e PORT=8000 nycity-sos:latest
```

```bash
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/city-sos:v1
gcloud run deploy city-sos \
  --image gcr.io/YOUR_GCP_PROJECT_ID/city-sos:v1 \
  --platform managed --region us-central1 \
  --allow-unauthenticated --port 8080
```

A public HTTPS URL isn't just polish — microphone access requires a secure context, so `getUserMedia` fails on plain HTTP anywhere but localhost.

---

## Demo Walkthrough

1. Open the main UI on one screen, the dispatch console on the other (standby radar sweeping).
2. **Normal mode** — *"I need to reach NYU campus security."* → spoken answer with the real 24/7 number.
3. **The turn** — *"I'd like to order a pizza."* → status dot goes amber, agent becomes Tony's Pizza.
4. **Coded details** — *"Seven pizzas. Extra cheese. Delivery to 5 MetroTech Center."*
5. **The trigger** — *"And extra pineapple on that."* → the agent quotes a delivery time; the console raises a red card with headcount 7, the spoken address, the stopwatch, and the real transcript.

Hit **Reset Session** on the main UI between rehearsals to clear the latch and the transcript. The `?dev=1` toolbar reproduces steps 3–5 without a microphone, for a noisy room or a denied mic permission. Full protocol and judge Q&A in `DEMO_AND_TESTING_GUIDE.md`.

---

## Design Notes & Limitations

- **Alerts go to pre-set trusted contacts, not directly to police.** In production this routes through a monitored dispatch center where a human verifies before emergency services are engaged — the model Noonlight and campus duress systems already run. That's the false-positive safeguard, and it's why the transcript ships with the alert.
- **The pizza code is deliberately the well-known one.** The point isn't the specific phrase — it's that a human 911 operator can't be trained for every improvised code in real time, while an AI agent can hold the cover fiction *and* extract structured fields simultaneously. The trigger phrase is configurable in principle.
- **One alert per session, by design.** Both the prompt and the client latch enforce it. A duress signal that fires five times is noise, not urgency.
- **Function calling only** on the Live session — no built-in tools or structured output alongside it, which is a known source of silent breakage. Temperature/topP/topK left at defaults.
- Map coordinates, user profile, and resource data are hardcoded for the demo; the spoken address overrides the display label but not the pin. Real deployments would use device geolocation, geocoding, an authenticated trusted-contact list, and the live NYC Emergency Management shelter feed.
- Alert state lives in memory — a server restart clears the board. Fine for a demo, not for a shift.
- Volunteer matching via `gemini-embedding-2` (needs ↔ offers cosine similarity) was scoped but deprioritized against the escalation flow.
