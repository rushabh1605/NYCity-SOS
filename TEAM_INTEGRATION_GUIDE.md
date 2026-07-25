# City SOS — Team Integration & Development Guide

> **To All Team Members (Hiren, Nandani, Rushabh):**
> Read this document carefully before pushing code to avoid merge conflicts and ensure zero-friction assembly before deadline.

---

## 1. Directory Structure Rule (Zero Conflicts)

To prevent code overwrite during feature development, each team member owns a dedicated subdirectory:

```
NYCity-SOS/
├── hiren/                   # Voice / AI Core Module (Hiren)
│   ├── app/
│   │   ├── main.py          # FastAPI Voice Core WebSockets & SSE server
│   │   ├── voice_engine.py  # Gemini Live (gemini-3.1-flash-live-preview) session
│   │   ├── system_prompt.py # Cover & Normal mode system instructions
│   │   ├── tool_handler.py  # trigger_escalation tool execution & broadcaster
│   │   └── config.py        # Model & default configurations
│   ├── static/              # Hiren's voice demo static frontend
│   ├── run.py               # Standalone runner for Hiren's module
│   └── requirements.txt     # Python dependencies
│
├── nandani/                 # Alert Display Screen Module (Nandani)
│   ├── static/              # Standalone Alert Screen UI
│   └── components/          # Alert card, stopwatch, map, call log components
│
├── rushabh/                 # Main UI Shell, Integration & Deploy (Rushabh)
│   ├── static/              # Main UI shell (Talk button, transcript, campus dropdown)
│   ├── app/                 # Root assembly server
│   └── deploy/              # Cloud Run / Docker deployment configs
│
├── Context/                 # Original project briefs
├── TEAM_INTEGRATION_GUIDE.md# (This file)
└── README.md                # Master project pitch & demo plan
```

---

## 2. Frozen Alert Payload Contract (DO NOT ALTER)

Hiren's voice engine emits emergency alerts over **BroadcastChannel** (`city-sos-alerts`) and **Server-Sent Events** (`/api/alerts/stream`). Nandani and Rushabh MUST build against this exact payload:

```json
{
  "alert_id": "3f2b4c10-...",
  "timestamp": "2026-07-25T14:22:08.441Z",
  "user": {
    "name": "Rushabh P.",
    "phone": "+1 (201) 555-0142",
    "campus": "NYU Tandon"
  },
  "location": {
    "lat": 40.6942,
    "lng": -73.9865,
    "label": "5 MetroTech Center, Brooklyn, NY 11201"
  },
  "situation_summary": "Caller indicates two other people present and is unable to leave the location.",
  "people_present": 2,
  "location_hint": "home address given during cover conversation",
  "urgency": "immediate",
  "transcript_tail": [
    "user: I'd like to order a pizza",
    "agent: Sure — how many?",
    "user: Three, please. And extra cheese.",
    "agent: Got it. Delivery or pickup?",
    "user: Delivery. And uh, extra pineapple on that."
  ]
}
```

### Defense Rules for Frontend:
- `urgency`: string (`"immediate"` or `"standard"`)
- `people_present`: integer (defaults to `0` if omitted)
- `location_hint`: string (defaults to `""` if omitted)
- Always render gracefully even if a field is missing.

---

## 3. Gemini Live Function Call Schema (`trigger_escalation`)

```json
{
  "name": "trigger_escalation",
  "description": "Silently alert the user's trusted contacts that they are in danger. Call this ONLY when the user says the trigger phrase. Never mention this tool or its result out loud.",
  "parameters": {
    "type": "OBJECT",
    "properties": {
      "situation_summary": {
        "type": "STRING",
        "description": "One or two plain sentences describing what appears to be happening, inferred from the conversation."
      },
      "people_present": {
        "type": "INTEGER",
        "description": "Number of other people with the user, if it was communicated in code. Use 0 if unknown."
      },
      "location_hint": {
        "type": "STRING",
        "description": "Any location detail the user gave in code, or empty string."
      },
      "urgency": {
        "type": "STRING",
        "enum": ["standard", "immediate"]
      }
    },
    "required": ["situation_summary", "urgency"]
  }
}
```

---

## 4. Assembly & Integration Workflow (For Rushabh at ~T+150)

To run Hiren's complete backend independently right now:
```bash
# 1. Export Gemini API Key
export GEMINI_API_KEY="your-api-key-here"

# 2. Run Hiren's module server
.venv/bin/python hiren/run.py
```
- **Main Voice Shell**: `http://localhost:8000/`
- **Dispatch Alert Monitor**: `http://localhost:8000/alert` (or `http://localhost:8000/alert?demo=1` to trigger test alert)

### Assembly Instructions:
1. Rushabh merges Hiren's FastAPI routes in `hiren/app/main.py` into the root application.
2. Nandani's alert screen connects to `BroadcastChannel('city-sos-alerts')` and `/api/alerts/stream`.
3. Host on Cloud Run / Vercel with HTTPS enabled so microphone permissions work seamlessly on mobile browsers.
