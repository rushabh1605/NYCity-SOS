import { VoiceAdapter } from '../integrations/voice_adapter.js';

document.addEventListener('DOMContentLoaded', () => {
  const talkBtn = document.getElementById('talkBtn');
  const talkStatusText = document.getElementById('talkStatusText');
  const talkHint = document.getElementById('talkHint');
  const statusDot = document.getElementById('statusDot');
  const statusLabel = document.getElementById('statusLabel');
  const transcriptBody = document.getElementById('transcriptBody');
  const campusSelect = document.getElementById('campusSelect');
  const devToolbar = document.getElementById('devToolbar');
  const chatInput = document.getElementById('chatInput');
  const sendChatBtn = document.getElementById('sendChatBtn');

  const transcriptHistory = [
    "agent: Hello! I'm your City SOS companion. How can I help you today?"
  ];

  let currentMode = 'normal';
  let alertTriggered = false;

  let bus = null;
  try {
    bus = new BroadcastChannel('city-sos-alerts');
  } catch (e) {
    console.warn('BroadcastChannel unavailable:', e);
  }

  const adapter = new VoiceAdapter({
    onConnected: () => {
      updateUIState('connected');
    },
    onDisconnected: () => {
      updateUIState('disconnected');
    },
    onListening: () => {
      updateUIState('listening');
    },
    onSpeaking: () => {
      updateUIState('speaking');
    },
    onUserTranscript: (text) => {
      appendTranscriptLine('user', text);
    },
    onAssistantTranscript: (text) => {
      appendTranscriptLine('agent', text);
    },
    onCoverModeEntered: () => {
      currentMode = 'cover';
      statusDot.className = 'status-dot cover-mode';
      statusLabel.textContent = "Cover Mode (Tony's Pizza)";
    },
    onToolCall: (name, args) => {
      if (name === 'trigger_escalation') {
        triggerEscalationAlert(
          args.situation_summary || "Emergency situation reported in cover mode.",
          args.people_present ?? 0,
          args.location_hint || "",
          args.urgency || "immediate"
        );
      }
    },
    onError: (err) => {
      updateUIState('error', err);
    }
  });

  talkBtn.addEventListener('click', () => {
    if (!adapter.isConnected && adapter.state === 'idle') {
      adapter.connect(true);
    } else {
      adapter.disconnect();
    }
  });

  function handleSendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    if (!adapter.isConnected) {
      adapter.connect(false).then(() => {
        adapter.sendTextMessage(text);
        chatInput.value = '';
      }).catch(() => {
        adapter.sendTextMessage(text);
        chatInput.value = '';
      });
    } else {
      adapter.sendTextMessage(text);
      chatInput.value = '';
    }
  }

  if (sendChatBtn) {
    sendChatBtn.addEventListener('click', handleSendChat);
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSendChat();
      }
    });
  }

  function updateUIState(state, errorMsg = '') {
    if (state === 'disconnected' || state === 'idle') {
      talkBtn.className = 'talk-btn';
      talkStatusText.textContent = "Tap to Talk";
      talkHint.textContent = "Ask about campus security or local emergency services.";
      if (currentMode === 'normal') {
        statusDot.className = 'status-dot';
        statusLabel.textContent = "Companion Ready";
      }
    } else if (state === 'connected' || state === 'listening') {
      talkBtn.className = 'talk-btn listening';
      talkStatusText.textContent = "Listening... Speak naturally";
      talkHint.textContent = currentMode === 'cover' 
        ? "Cover Mode Active — taking pizza order" 
        : "Ask a safety question or say: 'I'd like to order a pizza'";
      if (currentMode === 'normal') {
        statusDot.className = 'status-dot active';
        statusLabel.textContent = "Voice Active";
      }
    } else if (state === 'speaking') {
      talkBtn.className = 'talk-btn speaking';
      talkStatusText.textContent = "City SOS is speaking...";
    } else if (state === 'error') {
      talkBtn.className = 'talk-btn error';
      talkStatusText.textContent = errorMsg || "Microphone access required";
      talkHint.textContent = "You can also type your message in the chat box below.";
    }
  }

  function appendTranscriptLine(role, text) {
    const formattedLine = `${role}: ${text}`;
    transcriptHistory.push(formattedLine);

    const entryDiv = document.createElement('div');
    entryDiv.className = `transcript-entry ${role}`;
    
    const speakerDiv = document.createElement('div');
    speakerDiv.className = 'entry-speaker';
    speakerDiv.textContent = role === 'user' ? 'You' : 'City SOS Voice';
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'entry-bubble';
    bubbleDiv.textContent = text;
    
    entryDiv.appendChild(speakerDiv);
    entryDiv.appendChild(bubbleDiv);
    
    transcriptBody.appendChild(entryDiv);
    transcriptBody.scrollTop = transcriptBody.scrollHeight;
  }

  function getLatestTranscriptTail(count = 5) {
    return transcriptHistory.slice(-count);
  }

  function triggerEscalationAlert(situationSummary, peoplePresent, locationHint, urgency) {
    if (alertTriggered) {
      console.log('Escalation already triggered in this session. Preventing duplicate.');
      return;
    }
    alertTriggered = true;

    const selectedCampus = campusSelect ? campusSelect.value : "NYU Tandon";

    const alertPayload = {
      alert_id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'alert-' + Date.now(),
      timestamp: new Date().toISOString(),
      user: {
        name: "Rushabh P.",
        phone: "+1 (201) 555-0142",
        campus: selectedCampus
      },
      location: {
        lat: 40.6942,
        lng: -73.9865,
        label: "5 MetroTech Center, Brooklyn, NY 11201"
      },
      situation_summary: situationSummary || "Caller indicates two other people present and is unable to leave the location.",
      people_present: Number.isInteger(peoplePresent) ? peoplePresent : 0,
      location_hint: locationHint || "",
      urgency: urgency || "immediate",
      transcript_tail: getLatestTranscriptTail(5)
    };

    console.log('Posting exact frozen alert payload to BroadcastChannel city-sos-alerts:', alertPayload);

    if (bus) {
      bus.postMessage(alertPayload);
    }
  }

  // --- Development Mock Controls (?dev=1) ---
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('dev') === '1') {
    devToolbar.style.display = 'block';

    const devBtnPizza = document.getElementById('devBtnPizza');
    const devBtnPineapple = document.getElementById('devBtnPineapple');
    const devBtnFollowup = document.getElementById('devBtnFollowup');
    const devBtnReset = document.getElementById('devBtnReset');

    devBtnPizza.addEventListener('click', () => {
      adapter.setCoverMode();
      adapter.simulateUserSpeech("I'd like to order a pizza");
      setTimeout(() => {
        adapter.simulateAssistantSpeech("Sure — Tony's Pizza! How many pizzas can I get started for you today?");
      }, 500);
    });

    devBtnPineapple.addEventListener('click', () => {
      adapter.simulateUserSpeech("Three, please. Extra cheese. Delivery to 5 MetroTech Center. And extra pineapple on that.");
      setTimeout(() => {
        triggerEscalationAlert(
          "Caller indicates two other people present and extra cheese (unable to leave). Requested delivery to 5 MetroTech Center.",
          2,
          "5 MetroTech Center, Brooklyn NY",
          "immediate"
        );
        adapter.simulateAssistantSpeech("Extra pineapple, got it — that's gonna be about twenty-five minutes for delivery.");
      }, 500);
    });

    devBtnFollowup.addEventListener('click', () => {
      adapter.simulateUserSpeech("Can you make one of them thin crust?");
      setTimeout(() => {
        adapter.simulateAssistantSpeech("Absolutely, one thin crust pie added to your order. Anything else?");
      }, 500);
    });

    devBtnReset.addEventListener('click', () => {
      alertTriggered = false;
      currentMode = 'normal';
      statusDot.className = 'status-dot';
      statusLabel.textContent = "Companion Ready";
      transcriptHistory.length = 0;
      transcriptBody.innerHTML = '';
      appendTranscriptLine('agent', "Hello! I'm your City SOS companion. How can I help you today?");
    });
  }
});
