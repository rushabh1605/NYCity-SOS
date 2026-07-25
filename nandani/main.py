"""
City SOS Alert Dispatch Dashboard Backend
=========================================
This script initializes a FastAPI backend server designed to route distress beacons
and silent emergency alerts from the user's phone or AI voice loop (client side)
to a dispatcher monitoring dashboard using Server-Sent Events (SSE).

Features:
1. Real-time data streaming via HTTP SSE connection (`/api/events`).
2. Robust schema verification and fallback safety mechanisms (`/api/alert`).
3. Simulated debug route to mock system alerts (`/api/mock-alert`).
4. Support for local BroadcastChannel event replication.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, List
from dotenv import load_dotenv

# Try loading .env from parent directory or current directory
load_dotenv(dotenv_path="../.env")
load_dotenv()

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Initialize logger for diagnostic purposes
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("city-sos-alert-server")

# Instantiate FastAPI application
app = FastAPI(
    title="City SOS Alert Dispatch Dashboard",
    description="Python server for receiving, processing, and broadcasting incoming emergency signals."
)

# Mount static and templates folders for HTML, JS, and CSS rendering
app.mount("/static", StaticFiles(directory="nandani/static"), name="static")
templates = Jinja2Templates(directory="nandani/templates")

# In-memory list to store asynchronous queues of all active Server-Sent Events (SSE) subscribers
clients: List[asyncio.Queue] = []

# Global dictionary serving as cache for the latest active alert payload
latest_alert: Dict[str, Any] = {}

# Standard mock payload mimicking Hiren's voice client contract output
MOCK_ALERT_PAYLOAD = {
    "alert_id": "3f2b-mock-7c9e-2026",
    "timestamp": datetime.utcnow().isoformat() + "Z",
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

@app.get("/", response_class=HTMLResponse)
async def get_dashboard(request: Request):
    """
    Renders the dispatch monitoring dashboard interface.
    """
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/events")
@app.get("/api/alerts/stream")
async def sse_endpoint(request: Request):
    """
    Establishes a persistent Server-Sent Events (SSE) link with the monitoring browser client.
    Streams real-time updates of incoming alerts or clears existing ones.
    
    Flow:
    1. Instantiates a client-specific asyncio Queue.
    2. Registers the queue to the global clients array.
    3. Streams data sequentially using yield.
    4. Handles timeouts with keep-alive signals.
    5. Cleans up subscription upon client disconnection.
    """
    queue = asyncio.Queue()
    clients.append(queue)
    logger.info(f"New client connected to alert stream. Total clients: {len(clients)}")

    # Send the latest active alert immediately to the newly connected client (cold start recovery)
    if latest_alert:
        await queue.put(latest_alert)

    async def event_generator():
        try:
            while True:
                # Terminate loop if the browser tab/client closes connection
                if await request.is_disconnected():
                    logger.info("Client disconnected from event stream.")
                    break
                
                try:
                    # Non-blocking fetch with 2-second timeout to check connection status periodically
                    data = await asyncio.wait_for(queue.get(), timeout=2.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Send a keep-alive comment to prevent intermediate proxies/routers from dropping connection
                    yield ": keep-alive\n\n"
        except Exception as e:
            logger.error(f"Error in SSE stream: {e}")
        finally:
            # Cleanup registry on close
            if queue in clients:
                clients.remove(queue)
            logger.info(f"Cleaned up client connection. Total clients: {len(clients)}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/alert")
async def post_alert(payload: Dict[str, Any]):
    """
    POST route where Hiren's voice loop client sends parsed distress payloads.
    Includes input sanitization and default fallback values to guarantee dashboard stability.
    
    Validations:
    - Verifies JSON format and enforces non-empty payload.
    - Sanitizes 'urgency' level, defaulting to 'immediate' status.
    - Validates presence of coordinates; defaults to NYU Tandon coordinates if GPS values are missing.
    - Defaults 'people_present' to 0 and formats empty strings for optional details.
    """
    global latest_alert
    
    if not payload:
        raise HTTPException(status_code=400, detail="Empty payload")
    
    # Enforce schema integrity with fallback safety nets
    alert_id = payload.get("alert_id", f"auto-{datetime.utcnow().timestamp()}")
    timestamp = payload.get("timestamp", datetime.utcnow().isoformat() + "Z")
    
    sanitized_payload = {
        "alert_id": alert_id,
        "timestamp": timestamp,
        "user": payload.get("user", {
            "name": "Unknown User",
            "phone": "Unknown Contact",
            "campus": "General NYC"
        }),
        "location": payload.get("location", {
            "lat": 40.7128,
            "lng": -74.0060,
            "label": "Unknown NYC Location"
        }),
        "situation_summary": payload.get("situation_summary", "Emergency trigger detected."),
        "people_present": int(payload.get("people_present", 0)) if payload.get("people_present") is not None else 0,
        "location_hint": payload.get("location_hint", ""),
        "urgency": payload.get("urgency", "immediate").lower(),
        "transcript_tail": payload.get("transcript_tail", ["No transcript logs available."])
    }

    latest_alert = sanitized_payload
    logger.info(f"Broadcasting new alert: {alert_id} (Urgency: {sanitized_payload['urgency']})")

    # Broadcast to all connected SSE clients (e.g. browser windows or other devices)
    for q in clients:
        await q.put(sanitized_payload)

    return {"status": "success", "alert_id": alert_id}

@app.post("/api/mock-alert")
async def trigger_mock_alert(urgency: str = "immediate"):
    """
    Triggers a mock incident alert for demo testing.
    Can specify custom urgency parameter (immediate / standard).
    """
    payload = MOCK_ALERT_PAYLOAD.copy()
    payload["urgency"] = urgency
    payload["timestamp"] = datetime.utcnow().isoformat() + "Z"
    await post_alert(payload)
    return {"status": "mocked", "urgency": urgency}

@app.post("/api/clear")
async def clear_alert():
    """
    Broadcasts a clear action payload to empty current alerts on the frontend 
    and returns the dashboard to a green standby state.
    """
    global latest_alert
    latest_alert = {}
    
    # Broadcast clear signal to all SSE screens
    for q in clients:
        await q.put({"action": "clear"})
        
    return {"status": "cleared"}

if __name__ == "__main__":
    import uvicorn
    
    # Pre-create directory paths to avoid path resolution errors
    os.makedirs("nandani/static", exist_ok=True)
    os.makedirs("nandani/templates", exist_ok=True)
    
    # Read port configuration from environment variables (.env)
    port = int(os.getenv("PORT", 8000))
    
    logger.info(f"Starting City SOS Alert Server on http://127.0.0.1:{port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
