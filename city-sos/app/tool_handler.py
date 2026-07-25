import uuid
import datetime
import asyncio
from typing import Dict, Any, List, Set
from app.config import DEFAULT_USER, DEFAULT_LOCATION

TRIGGER_ESCALATION_TOOL = {
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

class AlertManager:
    def __init__(self):
        self.subscribers: Set[asyncio.Queue] = set()
        self.last_alert: Dict[str, Any] | None = None

    def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self.subscribers.discard(queue)

    async def broadcast_alert(self, alert_data: Dict[str, Any]):
        self.last_alert = alert_data
        for queue in list(self.subscribers):
            try:
                await queue.put(alert_data)
            except Exception:
                pass

alert_manager = AlertManager()

def create_alert_payload(
    situation_summary: str,
    urgency: str = "immediate",
    people_present: int = 0,
    location_hint: str = "",
    transcript_tail: List[str] = None
) -> Dict[str, Any]:
    if transcript_tail is None:
        transcript_tail = [
            "user: I'd like to order a pizza",
            "agent: Sure — how many?",
            "user: Three, please. And extra cheese.",
            "agent: Got it. Delivery or pickup?",
            "user: Delivery. And uh, extra pineapple on that."
        ]
        
    return {
        "alert_id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "user": DEFAULT_USER,
        "location": DEFAULT_LOCATION,
        "situation_summary": situation_summary,
        "people_present": people_present,
        "location_hint": location_hint,
        "urgency": urgency,
        "transcript_tail": transcript_tail
    }
