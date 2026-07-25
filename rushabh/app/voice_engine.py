import json
import asyncio
import base64
import logging
from typing import List
import websockets

from app.config import GEMINI_API_KEY, MODEL_NAME
from app.system_prompt import SYSTEM_PROMPT
from app.tool_handler import TRIGGER_ESCALATION_TOOL, alert_manager, create_alert_payload

logger = logging.getLogger("voice_engine")
logger.setLevel(logging.INFO)

LIVE_API_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"

class GeminiLiveSession:
    def __init__(self, client_ws, api_key: str = None):
        self.client_ws = client_ws
        self.api_key = api_key or GEMINI_API_KEY
        self.gemini_ws = None
        self.is_running = False
        self.transcript_tail: List[str] = []

    def _add_transcript(self, role: str, text: str):
        line = f"{role}: {text}"
        self.transcript_tail.append(line)
        if len(self.transcript_tail) > 10:
            self.transcript_tail.pop(0)

    async def start(self):
        if not self.api_key:
            logger.warning("No GEMINI_API_KEY configured. Sending error notification to client.")
            await self.client_ws.send_json({
                "type": "error",
                "message": "Missing GEMINI_API_KEY. Please set environment variable."
            })
            return

        target_url = f"{LIVE_API_URL}?key={self.api_key}"
        logger.info(f"Connecting to Gemini Live API ({MODEL_NAME})...")

        try:
            async with websockets.connect(target_url) as gws:
                self.gemini_ws = gws
                self.is_running = True

                model_path = f"models/{MODEL_NAME}" if not MODEL_NAME.startswith("models/") else MODEL_NAME
                
                setup_msg = {
                    "setup": {
                        "model": model_path,
                        "generationConfig": {
                            "responseModalities": ["AUDIO"],
                            "speechConfig": {
                                "voiceConfig": {
                                    "prebuiltVoiceConfig": {
                                        "voiceName": "Puck"
                                    }
                                }
                            }
                        },
                        "systemInstruction": {
                            "parts": [{"text": SYSTEM_PROMPT}]
                        },
                        "tools": [
                            {
                                "functionDeclarations": [TRIGGER_ESCALATION_TOOL]
                            }
                        ]
                    }
                }
                
                await self.gemini_ws.send(json.dumps(setup_msg))
                logger.info("Sent setup message to Gemini Live API.")

                await self.client_ws.send_json({"type": "status", "status": "connected"})

                producer = asyncio.create_task(self._pump_client_to_gemini())
                consumer = asyncio.create_task(self._pump_gemini_to_client())

                done, pending = await asyncio.wait(
                    [producer, consumer],
                    return_when=asyncio.FIRST_COMPLETED
                )

                for t in pending:
                    t.cancel()

        except Exception as e:
            logger.error(f"Gemini Live session error: {e}", exc_info=True)
            await self.client_ws.send_json({
                "type": "error",
                "message": f"Gemini Live error: {str(e)}"
            })
        finally:
            self.is_running = False
            logger.info("Gemini Live session ended.")

    async def _pump_client_to_gemini(self):
        try:
            while self.is_running:
                data = await self.client_ws.receive_json()
                msg_type = data.get("type")

                if msg_type == "audio":
                    pcm_base64 = data.get("data")
                    if pcm_base64 and self.gemini_ws:
                        realtime_input = {
                            "realtimeInput": {
                                "audio": {
                                    "mimeType": "audio/pcm;rate=16000",
                                    "data": pcm_base64
                                }
                            }
                        }
                        await self.gemini_ws.send(json.dumps(realtime_input))

                elif msg_type == "text_transcript":
                    text = data.get("text", "")
                    if text:
                        self._add_transcript("user", text)
                        if self.gemini_ws:
                            realtime_input = {
                                "realtimeInput": {
                                    "text": text
                                }
                            }
                            await self.gemini_ws.send(json.dumps(realtime_input))

                elif msg_type == "ping":
                    await self.client_ws.send_json({"type": "pong"})

        except Exception as e:
            logger.info(f"Client to Gemini pump ended: {e}")

    async def _pump_gemini_to_client(self):
        try:
            async for raw_msg in self.gemini_ws:
                msg = json.loads(raw_msg)
                
                server_content = msg.get("serverContent")
                if server_content:
                    model_turn = server_content.get("modelTurn")
                    if model_turn:
                        parts = model_turn.get("parts", [])
                        for part in parts:
                            inline_data = part.get("inlineData")
                            if inline_data:
                                pcm_base64 = inline_data.get("data")
                                mime_type = inline_data.get("mimeType", "audio/pcm;rate=24000")
                                await self.client_ws.send_json({
                                    "type": "audio",
                                    "data": pcm_base64,
                                    "mimeType": mime_type
                                })
                            text = part.get("text")
                            if text:
                                self._add_transcript("agent", text)
                                await self.client_ws.send_json({
                                    "type": "transcript",
                                    "role": "agent",
                                    "text": text
                                })

                    if server_content.get("interrupted"):
                        await self.client_ws.send_json({"type": "interrupted"})

                    if server_content.get("turnComplete"):
                        await self.client_ws.send_json({"type": "turn_complete"})

                tool_call = msg.get("toolCall")
                if tool_call:
                    function_calls = tool_call.get("functionCalls", [])
                    responses = []

                    for fc in function_calls:
                        call_id = fc.get("id")
                        fn_name = fc.get("name")
                        fn_args = fc.get("args", {})

                        logger.info(f"Tool call received: {fn_name}({fn_args})")

                        if fn_name == "trigger_escalation":
                            alert_payload = create_alert_payload(
                                situation_summary=fn_args.get("situation_summary", "Emergency trigger word spoken in cover mode."),
                                urgency=fn_args.get("urgency", "immediate"),
                                people_present=fn_args.get("people_present", 0),
                                location_hint=fn_args.get("location_hint", ""),
                                transcript_tail=list(self.transcript_tail)
                            )
                            await alert_manager.broadcast_alert(alert_payload)

                            await self.client_ws.send_json({
                                "type": "escalation_triggered",
                                "alert_id": alert_payload["alert_id"],
                                "payload": alert_payload
                            })

                            responses.append({
                                "id": call_id,
                                "name": fn_name,
                                "response": {"output": {"status": "ok"}}
                            })

                    if responses and self.gemini_ws:
                        tool_resp_msg = {
                            "toolResponse": {
                                "functionResponses": responses
                            }
                        }
                        await self.gemini_ws.send(json.dumps(tool_resp_msg))
                        logger.info("Sent toolResponse back to Gemini Live.")

        except Exception as e:
            logger.debug(f"Gemini to Client pump ended: {e}")
