# City SOS — Voice-First Safety & Relief Companion for NYC

**Track:** Gemini Live Voice
**Core model:** `gemini-3.1-flash-live-preview` + `gemini-embedding-2` (for volunteer matching)

## Updated Concept (Post Judge Feedback)
Expanded from a student-only safety tool into a **city-wide voice companion** — covers personal safety AND public emergency/relief access (heat waves, storms, cooling/heating centers), with student-specific personalization and a community volunteer-matching layer.

---

## Core Features

### 1. General NYC Mode (default)
Any NYC resident opens the app and talks naturally:
- *"It's really hot, where's the nearest cooling center?"*
- *"Storm's bad, is there a shelter near me?"*
Gemini Live + function calling pulls real-time nearest relief center (hardcode NYC Emergency Management cooling/heating shelter list for demo — small JSON dataset is enough).

### 2. Student Mode (personalized)
- One-time setup: select university + campus (e.g., NYU Tandon, Brooklyn campus)
- Once set, agent prioritizes school-specific resources first (campus security number, campus health center, RA/dorm safety contact) before falling back to general NYC info
- Stored locally/in-session — no need for full auth system in a demo, a simple settings screen is enough

### 3. Community Volunteer Matching (embeddings)
- Two flows: "I need help" / "I want to help"
- Each request/offer gets embedded via `gemini-embedding-2`
- Cosine similarity match between needs and nearby offers (e.g., "need warm clothes" ↔ "have blankets to donate")
- For demo: small hardcoded pool of sample volunteer profiles, live match shown when a new "need" comes in

### 4. Disguised Distress Mode ("talk in code")
- User can speak in coded/disguised language when they can't talk openly (e.g., unsafe situation, someone nearby)
- Agent is prompted to recognize disguise patterns and respond in the same coded language
- Example: user says *"how many people are with you?"* → agent replies *"how many pizzas do you want to order?"* mapping to a number, keeping the cover conversation natural
- System prompt trains the model to hold this "cover conversation" fluently while quietly triggering the real safety flow in the background

### 5. Secret Word → Real Emergency Escalation
- A trigger word/phrase (e.g., a specific code word) spoken naturally inside the voice conversation
- On detection, the agent silently:
  - Stops the cover conversation
  - Sends the user's live profile + situation summary + last known context to 911/emergency services (simulate with a webhook/mock endpoint for the demo)
  - Can keep talking normally to maintain the disguise while the backend has already escalated
- This is the highest-impact, most "wow" feature for the showcase — build and test this first if time is tight

---

## Fast Build Plan (Remaining Time)

**Priority order — build in this sequence, most critical first:**

1. **Secret word detection + escalation trigger** — core safety promise, do this first
2. **Gemini Live voice loop** — basic real-time conversation working
3. **Disguised mode system prompt** — cover conversation + hidden number extraction
4. **General NYC relief center lookup** — function call + small hardcoded dataset
5. **Student mode settings** — simple dropdown (university/campus) + resource priority logic
6. **Volunteer matching (embeddings)** — only if time remains; can be a simplified/mocked demo (pre-computed similarity scores) if the build window gets tight

## Demo Script for Showcase
1. Open app, show student mode set to NYU Tandon
2. Ask a normal question — get campus + city resource answer
3. Switch to "disguise" scenario — speak in code, show natural-sounding cover conversation
4. Say the secret word mid-conversation — show the silent escalation (mock alert firing with profile + situation)
5. Quick volunteer-match demo — a "need" request matching a nearby "offer"

This sequence hits every feature within ~2 minutes and ends on the most dramatic one (secret word escalation).
