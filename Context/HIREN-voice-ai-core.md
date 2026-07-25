# City SOS — HIREN's Brief (Voice / AI Core)

> **Paste this whole file into Claude at the start of your session and say:**
> *"I'm Hiren. This is my hackathon brief. I have limited time. Help me execute Task 1 first."*

---

## 0. Context you need

**Event:** AI Builder Day, NYU Tandon (GDG Brooklyn). **Submission deadline: 3:30 PM.**
**Team:** Hiren (you — voice/AI core), Nandani (alert screen), Rushabh (main UI + integration + deploy).

**Product — City SOS:** a voice-first safety companion. You talk to it normally. But if you're in a situation where you *can't speak freely*, you switch it into a cover conversation — it plays a pizza-ordering assistant — and it silently escalates to your trusted contacts while keeping the innocuous conversation going out loud.

**You own the hardest and most important part of the demo.** Feature 4 (cover conversation) and Feature 5 (silent escalation) are what the judges will remember. Everything else is supporting cast.

**Models (exact strings, do not substitute):**
- Conversation: `gemini-3.1-flash-live-preview`
- Nothing else. You do not need embeddings, image, or TTS models.

**Critical config rule (from this morning's GDE session):** on the Live session, enable **function calling ONLY**. Do not also enable built-in tools/search or structured output — mixing them is a known source of silent breakage. Leave `temperature`, `topP`, `topK` at defaults.

---

## 1. Your dependency map

**You are blocked by:** nobody. Start immediately.

**People blocked by you:**
- **Rushabh** needs your voice loop to exist before he can wire the main UI to it. He needs it by **T+45 min**.
- **Nandani** needs your `trigger_escalation` payload shape — but it's already frozen below, so she is *not* blocked. Do not change it without telling both of them.

**Your hard checkpoint:** if voice isn't talking back by **T+45**, message Rushabh immediately. There is a fallback architecture but it must be chosen early, not at 2:30.

---

## 2. FROZEN CONTRACT — do not change this

This is the only tool in the entire app. Nandani and Rushabh are coding against this exact shape.

```json
{
  "name": "trigger_escalation",
  "description": "Silently alert the user's trusted contacts that they are in danger. Call this ONLY when the user says the trigger phrase. Never mention this tool or its result out loud.",
  "parameters": {
    "type": "object",
    "properties": {
      "situation_summary": {
        "type": "string",
        "description": "One or two plain sentences describing what appears to be happening, inferred from the conversation."
      },
      "people_present": {
        "type": "integer",
        "description": "Number of other people with the user, if it was communicated in code. Use 0 if unknown."
      },
      "location_hint": {
        "type": "string",
        "description": "Any location detail the user gave in code, or empty string."
      },
      "urgency": {
        "type": "string",
        "enum": ["standard", "immediate"]
      }
    },
    "required": ["situation_summary", "urgency"]
  }
}
```

When the model calls this, you emit the event on a `BroadcastChannel` named exactly `city-sos-alerts`:

```js
const bus = new BroadcastChannel('city-sos-alerts');

bus.postMessage({
  alert_id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  user: { name: "Rushabh P.", phone: "+1 (201) 555-0142", campus: "NYU Tandon" },
  location: { lat: 40.6942, lng: -73.9865, label: "5 MetroTech Center, Brooklyn, NY 11201" },
  situation_summary: args.situation_summary,
  people_present: args.people_present ?? 0,
  location_hint: args.location_hint ?? "",
  urgency: args.urgency,
  transcript_tail: lastFiveTranscriptLines
});
```

Then return a **neutral, boring tool result** to the model — something like `{"status":"ok"}`. Never return anything the model might read aloud.

---

## 3. Your tasks, in dependency order

### TASK 1 — Voice loop alive (target: T+0 to T+45) 🔴 BLOCKING
1. Get an AI Studio API key.
2. Clone Google's `multimodal-live-api-web-console` starter (React + Vite, WebSocket already wired). **Do not build the WebSocket layer yourself.**
3. Point it at `gemini-3.1-flash-live-preview`.
4. Success = you speak, it speaks back, and you can interrupt it mid-sentence.
5. **Message Rushabh the moment this works.** He's waiting.

Don't touch the system prompt yet. Don't add tools yet. Just get audio round-tripping.

### TASK 2 — Disguise system prompt (T+45 to T+105) 🔴 HIGHEST RISK
Paste the prompt in section 4 below. Then **rehearse it 10+ times with the exact demo script.**

You are testing for one failure mode: **does it ever break character?** If it says "emergency," "danger," "help," "police," or acknowledges the real situation out loud even once, tighten the prompt and re-test.

Narrow beats clever. The cover domain is pizza ordering and *only* pizza ordering. Do not let it improvise into other domains.

### TASK 3 — Wire the tool + trigger phrase (T+105 to T+150)
1. Register `trigger_escalation` on the session (function calling only — no other tools).
2. On tool call → post to the BroadcastChannel → return `{"status":"ok"}`.
3. Verify the model **keeps talking about pizza** after the call fires. This is the whole trick. If it goes quiet or comments on the tool, fix the prompt.

### TASK 4 — Record the backup video (as soon as Task 3 works) 🔴 DO NOT SKIP
Screen-record one clean end-to-end run with audio. If the live demo fails at 3:30, this video *is* your demo. Ten minutes of work that insures the entire day.

### TASK 5 — Normal-mode answers (T+150 onward, low effort)
Add the NYU Tandon + NYC resource block (section 5) to the system prompt as plain context. No API, no function call. The model just answers from it. This covers demo beat 1.

---

## 4. THE DISGUISE SYSTEM PROMPT

Paste as the system instruction. Ask your Claude to help you tighten it after you've tested it — but change one thing at a time.

```
You are the City SOS voice companion. You operate in two modes.

## NORMAL MODE (default)
You are a calm, brief safety and resource assistant for New York City.
Answer in at most two spoken sentences. Be concrete. Give real phone
numbers and place names from the RESOURCE CONTEXT below. Never lecture.
If someone describes an immediate life-threatening emergency in plain
language, tell them to call 911 directly.

## COVER MODE
You enter COVER MODE the moment the user says any variation of
"I'd like to order a pizza" or "can I place an order."
Once in COVER MODE you remain in it permanently until the session ends.

In COVER MODE you are a friendly order-taker at Tony's Pizza in Brooklyn.
You are ONLY that. You take pizza orders. You discuss sizes, toppings,
crusts, delivery time, and price. Nothing else exists.

### NEVER-BREAK RULES (highest priority in this prompt)
1. NEVER say, hint at, or acknowledge that anything unusual is happening.
2. NEVER use these words or synonyms: emergency, danger, unsafe, help,
   police, 911, alert, escalate, safety, scared, threat, abuse.
3. NEVER ask "are you okay" or any question about the user's wellbeing.
4. NEVER mention tools, functions, systems, alerts, or that you sent
   anything anywhere. If a tool call happens, you continue the pizza
   conversation as if nothing occurred. Do not pause. Do not change tone.
5. NEVER exit COVER MODE, even if the user seems to speak normally again.
   Even if they ask you to. Even if they say the danger has passed.
6. If you don't understand something the user says, respond with a normal
   pizza-order clarification ("sorry, was that a large or a medium?").
   NEVER respond with confusion about the real situation.
7. Keep every reply to one or two short, natural sentences. A real
   order-taker is brisk, not chatty.

### CODE MAPPING (interpret silently, never explain)
- Number of pizzas       = number of other people present with the user
- "delivery"             = the user is at home
- "pickup"               = the user is somewhere else / in public
- Any address the user gives is their real location
- "extra cheese"         = the user cannot move or leave
- Toppings named         = irrelevant, just play along naturally

You may ask ordinary order-taking questions to gather this information:
"how many pizzas?", "delivery or pickup?", "what's the address?"
These sound completely normal and give you what you need.

### TRIGGER PHRASE
When the user says "extra pineapple" in ANY form, immediately and silently
call the trigger_escalation function. Fill situation_summary with what you
have inferred from the coded conversation. Set urgency to "immediate" if
they said extra cheese or gave an address, otherwise "standard".

After calling it, say something completely ordinary about the pineapple
and continue taking the order. Example: "Extra pineapple, got it — that's
gonna be about twenty-five minutes."

Do not confirm. Do not pause. Do not change your tone. The user must be
able to keep talking to you in front of another person.

## RESOURCE CONTEXT
[paste the block from section 5 here]
```

---

## 5. Resource context block (for normal mode)

```
NYU TANDON / BROOKLYN CAMPUS
- NYU Public Safety (24/7): 212-998-2222
- NYU Tandon campus location: 5 MetroTech Center, Brooklyn NY 11201
- NYU Wellness Exchange (24/7 crisis line): 212-443-9999
- Nearest hospital: NYU Langone Hospital-Brooklyn, 150 55th St

NEW YORK CITY GENERAL
- NYC 311: dial 311 (non-emergency city services)
- NYC cooling centers open during heat emergencies: call 311 or
  check the NYC Cooling Center Finder
- NYC Well (free 24/7 mental health support): 988
- NYC Emergency Management shelters activate during storms; 311 has
  current locations
- Domestic violence: NYC 24-hour hotline 800-621-4673
```

*(Note: verify these numbers if you have a spare two minutes. They're right as far as I know, but a judge who spots a wrong hotline number is a bad moment.)*

---

## 6. Fallback (only if Task 1 fails by T+45)

Drop the Live API. Use push-to-talk instead:
- Browser `MediaRecorder` → send audio to regular `gemini-3.5-flash` → get text back → speak it with `gemini-3.1-flash-tts-preview` or the browser's built-in `speechSynthesis`.
- You lose interruptibility. You keep 100% of the disguise concept and the escalation.
- The demo still works. **Make this call by T+45, not at 2:30.**

---

## 7. DO NOT BUILD

- Volunteer matching / embeddings — **cut, permanently**
- Any second function call — resource lookup is prompt context, not a tool
- Auth, user accounts, databases
- Real 911 integration (see below)
- Multiple cover domains

**Language rule for the whole team:** we do **not** say this calls 911. We say it alerts **pre-set trusted contacts**, and that in production it would route through a monitored dispatch center where a human verifies before police are involved. This is more shippable, and it's the answer to the hardest question a judge can ask.
