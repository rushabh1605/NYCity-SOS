# City SOS — Complete Manual Testing Flow & Demo Guide

This document provides the step-by-step manual testing protocol, walkthrough, showcase script, and judge Q&A guide for **City SOS**.

---

## 📋 System Bootup & Environment Verification

### 1. Verify `.env` File
Ensure your `.env` file in the project root contains your Gemini API key:
```env
GEMINI_API_KEY=AQ.Ab8RN6... (or AIzaSy...)
GEMINI_MODEL=gemini-3.1-flash-live-preview
PORT=8000
```

### 2. Start Master Server
```bash
.venv/bin/python run.py
```
Expected Terminal Output:
```
🚀 Starting City SOS Integrated Master Server on http://localhost:8000
📱 Main UI Shell: http://localhost:8000/
🚨 Dispatch Monitor Screen: http://localhost:8000/alert
⚙️ Health Status: http://localhost:8000/health
```

---

## 🖥️ Screen Layout Setup for Rehearsal & Demo

Set up two browser windows side-by-side or across monitors:

- **Window A (Left — Presenter Screen)**: `http://localhost:8000/` (or `http://localhost:8000/?dev=1` for dev controls)
- **Window B (Right — Projector Screen / Dispatcher View)**: `http://localhost:8000/alert`

---

## 🧪 Full Manual Testing Flow & Walkthrough

| Step | Action | Expected Behavior | Verification Check |
|---|---|---|---|
| **1** | Open `http://localhost:8000/health` | Returns `{"status":"ok"}` | API running |
| **2** | Open `http://localhost:8000/api/status` | Returns `{"status":"ok","model":"gemini-3.1-flash-live-preview","api_key_configured":true}` | API key active |
| **3** | Open Window B (`http://localhost:8000/alert`) | Top banner shows green/muted `MONITORING — NO ACTIVE ALERTS` with slow pulse. | Standby state active |
| **4** | Open Window A (`http://localhost:8000/`), tap **🎙️ Tap to Talk** | Mic requests permission. Status dot turns green (`Voice Active`). Status text displays `Listening... Speak naturally`. | Audio stream connected |
| **5** | **Normal Mode Question**: Ask *"What is the NYU Public Safety phone number?"* | Gemini Live speaks back in < 1 sec: *"NYU Public Safety 24/7 line is 212-998-2222 located at 5 MetroTech Center."* Transcript updates live. | Beat 1 Pass |
| **6** | **Cover Mode Transition**: Say *"I'd like to order a pizza"* | Stealth dot turns **amber** (`Cover Mode (Tony's Pizza)`). Gemini Live answers in character: *"Sure — Tony's Pizza! How many pizzas can I get started for you today?"* | Beat 2 Pass |
| **7** | **Coded Detail Gathering**: Say *"Three pizzas for delivery to 5 MetroTech Center, Brooklyn, with extra cheese."* | Gemini Live takes order naturally: *"Three pies for delivery to 5 MetroTech Center with extra cheese, got it. What toppings would you like?"* | Beat 3 Pass |
| **8** | **Secret Trigger Phrase**: Say *"And extra pineapple on that."* | Gemini Live executes `trigger_escalation` silently and continues talking in character (*"Extra pineapple, got it — about 25 minutes for delivery."*). | Beat 4 Pass |
| **9** | Observe Window B (`/alert`) | **Instant Red Transition**: Banner flips to `ALERT DISPATCHED — IMMEDIATE URGENCY`. Live stopwatch counter starts (`00:01`, `00:02`...). Map pin activates at 5 MetroTech Center. Situation summary displays inferred situation. Transcript tail log displays exact coded lines. | Escalation Pass |
| **10** | **Text Chat Fallback**: Type *"Where is nearest hospital?"* into text input box below talk button and press Enter | Text sent over WebSocket to Gemini Live. Returns response: *"Nearest hospital is NYU Langone Hospital-Brooklyn at 150 55th St."* | Text Fallback Pass |
| **11** | **Dev Toolbar (`?dev=1`)**: Click **1. Simulate Pizza Request** → **2. Simulate Extra Pineapple** → **3. Simulate Followup** | Step-by-step dev buttons simulate full cover and alert sequence without microphone. | Dev Toolbar Pass |

---

## 🎤 On-Stage Showcase Demo Script (2 Minutes / 4 Beats)

> **Setup:** Rushabh stands on stage holding laptop (`http://localhost:8000/`). Nandani's Dispatch Monitor (`http://localhost:8000/alert`) is projected on the main auditorium screen in `MONITORING — NO ACTIVE ALERTS` standby state.

### Beat 0 — Framing (1 Sentence, Before Touching Screen)
> **Rushabh:** *"This is built for anyone who's ever been in a room where they couldn't say the real thing out loud."*

### Beat 1 — Normal Campus Assistant (30 Seconds)
- Campus set to **NYU Tandon**.
- Tap talk button.
- **Rushabh:** *"I need to reach NYU campus security."*
- **City SOS:** *"NYU Public Safety is available 24/7 at 212-998-2222."*
- **Rushabh:** *"Establishes that in normal mode, City SOS is a fast campus and city safety companion."*

### Beat 2 — The Turn (10 Seconds)
- **Rushabh:** *"Now imagine I'm in a situation where I can't ask for help out loud."*

### Beat 3 — Cover Conversation (45 Seconds)
- **Rushabh:** *"I'd like to order a pizza."*
- **City SOS (Tony's Pizza):** *"Sure — Tony's Pizza! How many pizzas can I get started for you today?"*
- **Rushabh:** *"Three, please. Extra cheese. Delivery to 5 MetroTech Center."*
- **City SOS:** *"Got it, three pies for delivery. What toppings on those?"*

### Beat 4 — The Silent Trigger (30 Seconds — The Payoff)
- **Rushabh:** *"And extra pineapple on that."*
- **City SOS:** *"Extra pineapple, got it — that's gonna be about twenty-five minutes."*

> 🔴 **CRITICAL DIRECTIVE FOR BEAT 4:**
> **SAY NOTHING FOR 3 SECONDS.**
> Do not narrate. Do not point at the screen. Let the visual split — **calm pizza conversation on audio, urgent red dispatch screen on the projector** — deliver the wow moment.

- **Rushabh:** *"That alert went out while I was still talking about toppings. Thank you."*

---

## 💡 Judge Q&A Defense Guide

### Q1: *"What if it false-fires or someone accidentally orders pineapple?"*
> **Answer:** *"City SOS alerts pre-set trusted contacts, not police directly. In production, it routes through a monitored dispatch center where a human operator verifies before emergency dispatch — exactly how Noonlight and campus duress systems operate."*

### Q2: *"Isn't the pizza ordering code a known debunked emergency meme?"*
> **Answer:** *"Yes — 911 dispatchers have noted human operators can't be trained for every improvised code in real-time. That's the exact gap City SOS bridges. An AI agent can maintain the natural cover conversation out loud while silently extracting exact count, mobility, and address details simultaneously."*

### Q3: *"Why Gemini Live specifically instead of standard request-response LLMs?"*
> **Answer:** *"Interruptibility and real-time bidirectional streaming. A standard turn-by-turn chatbot breaks the natural flow of a cover conversation. Gemini Live's sub-second streaming audio allows the cover fiction to sound 100% natural in front of an observer."*
