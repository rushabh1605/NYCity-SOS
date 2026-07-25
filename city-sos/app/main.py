import os
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Path
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.config import GEMINI_API_KEY, MODEL_NAME
from app.voice_engine import GeminiLiveSession
from app.tool_handler import alert_manager, create_alert_payload

app = FastAPI(title="City SOS — Voice Safety Companion")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
INTEGRATIONS_DIR = os.path.join(BASE_DIR, "integrations")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/integrations", StaticFiles(directory=INTEGRATIONS_DIR), name="integrations")

@app.get("/")
async def get_main_page():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/alert")
async def get_alert_page():
    return FileResponse(os.path.join(STATIC_DIR, "alert.html"))

@app.get("/health")
async def get_health_status():
    return JSONResponse({"status": "ok"})

@app.get("/api/status")
async def get_status():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "api_key_configured": bool(GEMINI_API_KEY),
        "active_alerts_count": len(alert_manager.active_alerts)
    }

@app.get("/api/alerts/stream")
async def stream_alerts():
    async def event_generator():
        queue = alert_manager.subscribe()
        try:
            # Send initial state with all currently active alerts
            initial_payload = {
                "action": "initial_state",
                "all_alerts": alert_manager.active_alerts
            }
            yield f"data: {json.dumps(initial_payload)}\n\n"

            while True:
                data = await queue.get()
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            alert_manager.unsubscribe(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/alerts/trigger-demo")
@app.get("/api/alerts/trigger-demo")
async def trigger_demo_alert():
    alert_payload = create_alert_payload(
        situation_summary="Caller indicates two other people present and is unable to leave the location.",
        people_present=2,
        location_hint="5 MetroTech Center, Brooklyn NY",
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
    return JSONResponse({"status": "alert_broadcasted", "alert": alert_payload, "active_alerts": alert_manager.active_alerts})

@app.post("/api/alerts/clear")
@app.get("/api/alerts/clear")
async def clear_all_alerts():
    await alert_manager.clear_all()
    return JSONResponse({"status": "all_alerts_cleared"})

@app.post("/api/alerts/dismiss/{alert_id}")
async def dismiss_alert(alert_id: str = Path(...)):
    await alert_manager.dismiss_alert(alert_id)
    return JSONResponse({"status": "alert_dismissed", "alert_id": alert_id})

@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket, api_key: str = Query(None)):
    await websocket.accept()
    effective_api_key = api_key or GEMINI_API_KEY
    session = GeminiLiveSession(client_ws=websocket, api_key=effective_api_key)
    try:
        await session.start()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket endpoint error: {e}")
