# City SOS — NANDANI's Brief (Alert Screen / The Payoff)

> **Paste this whole file into Claude at the start of your session and say:**
> *"I'm Nandani. This is my hackathon brief. I have limited time. Help me execute Task 1 first."*

---

## 0. Context you need

**Event:** AI Builder Day, NYU Tandon (GDG Brooklyn). **Submission deadline: 3:30 PM.**
**Team:** Hiren (voice/AI core), Nandani (you — alert screen), Rushabh (main UI + integration + deploy).

**Product — City SOS:** a voice-first safety companion. You talk to it normally. But if you're in a situation where you *can't speak freely*, you switch it into a cover conversation — it plays a pizza-ordering assistant — and it silently escalates to your trusted contacts while the innocuous conversation keeps going out loud.

**You own the moment the demo is built around.** On stage, Rushabh will be having a calm conversation about pizza toppings while **your screen** lights up on the projector with a real alert. Calm voice, urgent screen. That split-second is what wins this.

Treat your screen as a *product*, not a debug view. Build it like something a dispatcher would actually stare at during a shift.

---

## 1. Your dependency map

**You are blocked by:** nobody. The payload shape is frozen below — build against it with fake data and you'll integrate in minutes.

**People blocked by you:** Rushabh, at integration (~T+150). He needs your page to be openable as a standalone route/window that listens on the channel.

**What you must NOT wait for:** do not wait for Hiren's voice loop. Hardcode a fake alert, render it, and make it beautiful. Integration is a 10-minute job at the end *if* you code to the contract.

---

## 2. FROZEN CONTRACT — build exactly against this

Hiren's model emits this on a `BroadcastChannel` named exactly `city-sos-alerts`. Same-origin browser windows, no backend needed.

```js
const bus = new BroadcastChannel('city-sos-alerts');

bus.onmessage = (e) => {
  const alert = e.data;
  // render it
};
```

Payload shape — assume every field, but **defend against missing ones**:

```json
{
  "alert_id": "3f2b...",
  "timestamp": "2026-07-25T14:22:08.441Z",
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
```

`urgency` is either `"immediate"` or `"standard"`. `people_present` may be `0`. `location_hint` may be `""`. Never crash on a missing field.

---

## 3. Your tasks, in dependency order

### TASK 1 — Static alert card, fake data (T+0 to T+50) 🔴 START HERE
Build the page with the JSON above hardcoded. No channel, no listener yet. Just make it look right.

What must be on screen, in this visual priority:
1. **A hard status banner** — `ALERT DISPATCHED` — red, unmissable, top of screen
2. Time elapsed since the alert, **counting up live** (`00:04`, `00:05`…) — this creates urgency better than anything else you can build
3. Name, phone, campus
4. **Location label + a map** — an embedded map or even a static map image pinned at 40.6942, -73.9865. Judges' eyes go straight to a map.
5. `situation_summary` in large type — this is the model's inference, it's the smartest thing on screen, give it room
6. People present, as a number, large
7. `transcript_tail` in a monospace panel at the bottom, styled like a call log

**Design direction:** dark background, high-contrast red/amber for the alert state, one clean sans-serif, generous spacing. Think air-traffic-control or a hospital monitor — restrained and serious, not a consumer app. Do not use emoji anywhere on this screen. It's a safety product; the visual seriousness *is* the argument.

### TASK 2 — Empty / standby state (T+50 to T+70)
Before an alert fires, this screen is on the projector looking calm: a muted `MONITORING — NO ACTIVE ALERTS` state with a slow pulse. The contrast between standby and alert is the drama. Without a standby state there's no transition to see.

### TASK 3 — Wire the listener (T+70 to T+90)
Add the `BroadcastChannel` listener. Add a `?demo=1` URL param that fires the fake alert after 2 seconds so you can test the transition on repeat without Hiren.

Make the transition *land*: sub-second, a sharp color flip, no fade-in animation longer than 200ms. Consider a short audio cue — but **test the room's volume first**, and kill it if it's at all comical.

### TASK 4 — Handoff to Rushabh (~T+150)
Tell him the route/URL. He opens it in a second browser window for the projector. Test one real end-to-end fire with Hiren before 2:45.

### TASK 5 — Only if you're ahead (optional)
Make it work **cross-device** so the alert lands on a phone instead of a second window: tiny FastAPI server + SSE, same payload. Much more impressive, meaningfully more risk. **Only start this if the BroadcastChannel version is fully done and rehearsed.** Do not start it after 2:15.

---

## 4. Judge-proofing note

The hardest question we'll get is *"what happens on a false alarm?"*

Help answer it visually: put a small, permanent line at the bottom of the alert screen —

> `Pending human verification · Dispatch requires operator confirmation`

That single line shows we thought about the failure mode. We do **not** claim this calls 911 automatically. It alerts pre-set trusted contacts, and in production routes through a monitored dispatch center where a human verifies before police are involved. Keep the screen consistent with that story.

---

## 5. DO NOT BUILD

- Volunteer matching / embeddings — **cut, permanently.** This was in the old plan. It is gone. Ignore any earlier doc that mentions it.
- Auth, login, user accounts
- A database — everything is in memory
- Alert history / list views — **one** alert, rendered beautifully
- Settings on this screen — that's Rushabh's app

You have one screen. Make it the best-looking thing anyone shows today.
