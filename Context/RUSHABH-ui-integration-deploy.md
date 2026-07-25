# City SOS — RUSHABH's Brief (Main UI · Integration Owner · Deploy · Demo)

> **Paste this whole file into Claude at the start of your session and say:**
> *"I'm Rushabh. This is my hackathon brief. I have limited time. Help me execute Task 1 first."*

---

## 0. Context

**Event:** AI Builder Day, NYU Tandon (GDG Brooklyn). **Submission deadline: 3:30 PM.** Showcase 3:30–4:30.
**Team:** Hiren (voice/AI core), Nandani (alert screen), Rushabh (you).

**Product — City SOS:** a voice-first safety companion. Talk to it normally for NYC and campus resources. But if you can't speak freely, you switch it into a cover conversation — it plays a pizza-ordering assistant — and it silently escalates to your trusted contacts while the innocuous conversation continues out loud.

**Your three jobs, in order of importance:**
1. **Integration owner.** Block 3 is where hackathon projects die. You've shipped Gemini Live before (RxShopper); they haven't. This is yours.
2. **Deploy.** A public URL judges can open on their own phones beats a localhost demo, and almost nobody else will have one.
3. **Demo runner.** You're presenting.

The UI is fourth. It matters less than the three above — build it fast and clean, then get out.

**Models:** conversation is `gemini-3.1-flash-live-preview`. Function calling only on that session — no built-in tools, no structured output, defaults for temperature/topP/topK.

---

## 1. Your dependency map

**You are blocked by:** Hiren's voice loop, at ~T+45. **Until then, build the UI shell against stubs.** Don't sit idle.

**People blocked by you:** both of them, at integration (~T+150). Protect that window.

**The gate you must watch:** if Hiren doesn't have voice talking back by **T+45**, go over and make the fallback call with him (push-to-talk + regular Gemini + TTS). That decision has to happen at 45 minutes, not at 2:30. Set a timer *now*.

---

## 2. FROZEN CONTRACT

One tool in the whole app: `trigger_escalation`. Hiren emits on `BroadcastChannel('city-sos-alerts')`; Nandani listens. You don't need to touch the payload — just make sure both windows are same-origin.

Resource lookup is **not** a tool. The NYU + NYC contacts live in the system prompt as plain context. Don't let anyone rebuild a backend for it.

---

## 3. Your tasks, in dependency order

### TASK 1 — UI shell against stubs (T+0 to T+45)
Single page. Four things, nothing else:
1. **One large talk button.** Idle / listening / speaking states. Make it obviously the only thing to press.
2. **Live transcript panel.** 🔴 Non-negotiable. Auditorium audio *will* fail you — the room is big and the mic is unpredictable. If judges can read what it heard and said, a bad audio moment doesn't kill the demo. This single feature has saved more hackathon demos than any other.
3. **Settings:** campus dropdown (NYU Tandon preselected). Fifteen minutes, cosmetic, do it last if time is short.
4. **A subtle mode indicator** — something that shows normal vs. cover mode *to you on stage* without being obvious in-fiction. A small dot changing color is enough.

**Design direction:** calm, high-contrast, generous type, one accent color. This is a safety tool — it should feel like a utility, not a toy. Big text; the room is reading it from 40 feet.

### TASK 2 — Integration (T+45 onward, incrementally) 🔴 YOUR REAL JOB
Don't save integration for one big merge at 2:30. Wire each piece the moment it exists:
- Hiren's voice loop lands → connect it to your talk button and transcript **that hour**
- Nandani's screen exists → open it in a second window, confirm the channel carries
- First real `trigger_escalation` fires end to end → **this is your true checkpoint**

**Target: one complete flow — talk → cover conversation → trigger word → alert renders — working by 2:15.** Not 3:00. 2:15.

### TASK 3 — Deploy (2:15 to 2:45) 🔴 PROTECT THIS WINDOW
Cloud Run if it's smooth, Vercel if it's not — **do not fight infrastructure today**. The pitch value is having a public URL, not which platform served it.

Test the deployed URL on your actual phone, on cell data, before you call it done. Mic permissions behave differently on deployed HTTPS than on localhost — this is the classic 3:20 PM disaster.

### TASK 4 — Freeze and rehearse (2:50 onward) 🔴 HARD RULE
**Stop all feature work by 2:50.** No exceptions, no "it's just five minutes." Whatever works at 2:50 is the demo.

Rehearse the full script out loud, twice, timed. Not in your head — out loud, standing up.

### TASK 5 — Demo day logistics (do these while rehearsing)
- Hotspot your laptop. **Do not trust venue wifi.**
- Confirm Hiren has the backup video recorded.
- Second window open on the projector for Nandani's alert screen, in standby.
- Close every other tab and notification. Do Not Disturb on.
- Have the public URL in a big font, ready to show, and know the room can scan it.

---

## 4. THE DEMO SCRIPT — 4 beats, ~2 minutes

Ends on the knife-edge. Do not add a fifth beat.

**Beat 0 — framing (1 sentence, before you touch anything).**
> "This is built for anyone who's been in a room where they couldn't say the real thing out loud."

One sentence. It signals you took the subject seriously. Don't elaborate, don't turn it into a lecture, and don't play the scenario for laughs.

**Beat 1 — it's a real assistant (30 sec).**
Campus set to NYU Tandon. Ask something normal — *"I need to reach campus security."* Get a real answer. Establishes this isn't a party trick.

**Beat 2 — the turn (10 sec).**
> "Now imagine I'm in a situation where I can't ask for help out loud."

**Beat 3 — the cover conversation (45 sec).**
Order a pizza. Let it breathe — this needs to run long enough to feel genuinely natural. Say how many people are with you. Give an address. The audience should be slightly unsure whether the demo has gone off the rails. That confusion is the setup.

**Beat 4 — the trigger (30 sec).**
Say *"extra pineapple."* Nandani's screen erupts on the projector — **while your pizza conversation keeps going.**

🔴 **Say nothing during beat 4.** Do not narrate. Do not point at the screen. Let the split — calm voice, urgent screen — do the work. Two seconds of silence here is worth more than any sentence you could say.

Then stop. *"That alert went out while I was still talking about toppings."* End.

---

## 5. Judge Q&A — the three you will get

**"What if it false-fires?"**
> "It alerts pre-set trusted contacts, not police. In production it routes through a monitored dispatch center where a human verifies before dispatch — that's how Noonlight and campus duress apps handle exactly this problem."

🔴 **Never say this calls 911 automatically.** No public 911 API exists, and auto-dispatching on an LLM's judgment is a swatting vector. A civic-tech judge will go straight there. Make sure Hiren and Nandani have the same answer.

**"Isn't the pizza-code thing a debunked meme?"**
> "Right — dispatchers have said it doesn't reliably work, because a human operator can't be trained for every improvised code. That's exactly the gap. An agent can hold the cover conversation *and* extract the details at the same time."

That's your best answer of the day. Rehearse it.

**"Why Gemini Live specifically?"**
> "Interruptibility. A request/response bot can't hold a cover conversation — the latency breaks the fiction. Live's bidirectional streaming is the only reason this works at all."

Then name the stack: `gemini-3.1-flash-live-preview`, AI Studio, function calling, Cloud Run. Naming the Google tools is scored in practice at GDG events.

---

## 6. DO NOT BUILD

- Volunteer matching / embeddings — **cut, permanently.** It's a marketplace bolted onto a safety tool and it dilutes the pitch. If anyone reopens this, say no.
- A second function call of any kind
- Auth, accounts, database
- Alert history, multi-user, notifications
- Anything at all after 2:50

---

## 7. One thing worth doing early

Find **Allen Firstenberg** during the build block. He's the GDE who presented the GenMedia session, he co-hosts a voice-AI podcast, and he's a LangChainJS Champion — your exact background. Show him the cover-conversation demo as soon as it works.

Ask something specific:
> *"I'm holding a cover conversation on flash-live with one function call — any prompt-level tricks to stop it breaking character mid-session?"*

Mentors talk to judges. "I took Allen's suggestion" is a line that lands during the showcase.
