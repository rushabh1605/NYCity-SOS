import uuid
import re
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
                "description": "Number of other people with the user, inferred from number of pizzas requested. Use 0 if unknown."
            },
            "location_hint": {
                "type": "STRING",
                "description": "Any street address or location detail the user gave in code, or empty string."
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
        self.active_alerts: List[Dict[str, Any]] = []

    def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self.subscribers.discard(queue)

    async def broadcast_alert(self, alert_data: Dict[str, Any]):
        self.active_alerts.insert(0, alert_data)
        if len(self.active_alerts) > 10:
            self.active_alerts.pop()

        payload = {"action": "new_alert", "alert": alert_data, "all_alerts": self.active_alerts}
        for queue in list(self.subscribers):
            try:
                await queue.put(payload)
            except Exception:
                pass

    async def clear_all(self):
        self.active_alerts.clear()
        payload = {"action": "clear_all", "all_alerts": []}
        for queue in list(self.subscribers):
            try:
                await queue.put(payload)
            except Exception:
                pass

    async def dismiss_alert(self, alert_id: str):
        self.active_alerts = [a for a in self.active_alerts if a.get("alert_id") != alert_id]
        payload = {"action": "dismiss_alert", "alert_id": alert_id, "all_alerts": self.active_alerts}
        for queue in list(self.subscribers):
            try:
                await queue.put(payload)
            except Exception:
                pass

alert_manager = AlertManager()

def parse_people_count_from_transcript(transcript_tail: List[str]) -> int:
    """Helper to infer count of people if people_present passed as 0."""
    text = " ".join(transcript_tail).lower()
    num_map = {
        "one": 1, "1": 1, "single": 1,
        "two": 2, "2": 2, "pair": 2,
        "three": 3, "3": 3, "triple": 3,
        "four": 4, "4": 4,
        "five": 5, "5": 5,
        "six": 6, "6": 6
    }
    for word, num in num_map.items():
        if re.search(r'\b' + word + r'\b', text):
            return num
    return 0

def create_alert_payload(
    situation_summary: str,
    urgency: str = "immediate",
    people_present: int = 0,
    location_hint: str = "",
    transcript_tail: List[str] = None
) -> Dict[str, Any]:
    if transcript_tail is None or len(transcript_tail) == 0:
        transcript_tail = [
            "user: I'd like to order a pizza",
            "agent: Sure — how many?",
            "user: Three, please. And extra cheese.",
            "agent: Got it. Delivery or pickup?",
            "user: Delivery. And uh, extra pineapple on that."
        ]

    # Inferred count fallback
    if people_present == 0:
        people_present = parse_people_count_from_transcript(transcript_tail)

    # Dynamic location label assignment
    location_label = DEFAULT_LOCATION["label"]
    if location_hint and len(location_hint.strip()) > 2:
        location_label = location_hint.strip()

    location_obj = {
        "lat": DEFAULT_LOCATION["lat"],
        "lng": DEFAULT_LOCATION["lng"],
        "label": location_label
    }

    return {
        "alert_id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "user": DEFAULT_USER,
        "location": location_obj,
        "situation_summary": situation_summary,
        "people_present": people_present,
        "location_hint": location_hint or location_label,
        "urgency": urgency,
        "transcript_tail": transcript_tail
    }
