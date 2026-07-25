"""
City SOS Unified Integration Server
===================================
Assembles Hiren's Voice Core websocket services with Nandani's polished 
emergency dispatch dashboard into a single, cohesive FastAPI deployment.
"""

import os
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Query
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv

# Load env variables from root level
load_dotenv()

# Import Hiren's core voice module components
from hiren.app.config import GEMINI_API_KEY, MODEL_NAME
from hiren.app.voice_engine import GeminiLiveSession
from hiren.app.tool_handler import alert_manager, create_alert_payload

app = FastAPI(title="City SOS — Unified Assembly Application")

# Enable CORS for cross-device support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Mount Static folders
# Mount Hiren's assets folder as the main static
app.mount("/static", StaticFiles(directory="hiren/static"), name="static")
# Mount Nandani's static folder at a separate subpath to avoid route prefix collision
app.mount("/nandani-static", StaticFiles(directory="nandani/static"), name="nandani-static")

# 3. Template engine setup for Nandani's dashboard UI
templates = Jinja2Templates(directory="nandani/templates")

@app.get("/", response_class=FileResponse)
async def get_index():
    """
    Serves Hiren's Voice Assistant Client page.
    """
    return FileResponse("hiren/static/index.html")

@app.get("/alert", response_class=HTMLResponse)
async def get_alert_page(request: Request):
    """
    Serves Nandani's beautiful emergency dispatch screen as a rendered Template
    passing the custom CSS static asset path.
    """
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "css_path": "/nandani-static/style.css"
    })

@app.get("/api/status")
async def get_status():
    """
    Diagnostics endpoint for verification.
    """
    return {
        "status": "ok",
        "assembly": "unified_city_sos",
        "voice_model": MODEL_NAME,
        "api_key_configured": bool(GEMINI_API_KEY)
    }

@app.get("/api/alerts/stream")
async def stream_alerts():
    """
    SSE stream endpoint where the alert dashboard listens for incoming beacons.
    Broadcasting is controlled by Hiren's AlertManager singleton.
    """
    async def event_generator():
        # Subscribe to active broadcasts
        queue = alert_manager.subscribe()
        try:
            # Cold-start support: send the last alert to newly connected dashboard
            if alert_manager.last_alert:
                yield f"data: {json.dumps(alert_manager.last_alert)}\n\n"
            else:
                yield f": heartbeat\n\n"

            while True:
                # Blocks until an alert is triggered
                alert_data = await queue.get()
                yield f"data: {json.dumps(alert_data)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            # Clean up on disconnect
            alert_manager.unsubscribe(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/alerts/trigger-demo")
@app.get("/api/alerts/trigger-demo")
async def trigger_demo_alert():
    """
    Triggers a mock incident alert for demo testing.
    """
    alert_payload = create_alert_payload(
        situation_summary="Caller indicates two other people present and is unable to leave the location.",
        people_present=2,
        location_hint="home address given during cover conversation",
        urgency="immediate",
        transcript_tail=[
            "user: I'd like to order a pizza",
            "agent: Sure — how many?",
            "user: Three, please. And extra cheese.",
            "agent: Got it. Delivery or pickup?",
            "user: Delivery. And uh, extra pineapple on that."
        ]
    )
    await alert_manager.broadcast_alert(alert_payload)
    return JSONResponse({"status": "alert_broadcasted", "alert": alert_payload})

@app.post("/api/clear")
async def clear_alerts():
    """
    Clears the active alert state and resets all listening dispatch screens.
    """
    alert_manager.last_alert = None
    for queue in list(alert_manager.subscribers):
        try:
            await queue.put({"action": "clear"})
        except Exception:
            pass
    return {"status": "cleared"}

@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket, api_key: str = Query(None)):
    """
    Websocket proxy connecting the browser mic stream to Gemini Live Bidirectional services.
    """
    await websocket.accept()
    effective_api_key = api_key or GEMINI_API_KEY
    session = GeminiLiveSession(client_ws=websocket, api_key=effective_api_key)
    try:
        await session.start()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket endpoint error: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"Starting Unified City SOS Application on http://127.0.0.1:{port}")
    uvicorn.run("app_assembly:app", host="0.0.0.0", port=port, reload=True)
