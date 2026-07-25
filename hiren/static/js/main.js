// Hiren's Voice Core Web Audio Client
document.addEventListener('DOMContentLoaded', () => {
  const talkBtn = document.getElementById('talkBtn');
  const talkStatusText = document.getElementById('talkStatusText');
  const talkHint = document.getElementById('talkHint');
  const statusDot = document.getElementById('statusDot');
  const statusLabel = document.getElementById('statusLabel');
  const transcriptBody = document.getElementById('transcriptBody');

  let ws = null;
  let isConnected = false;
  let audioContext = null;
  let micStream = null;
  let micProcessor = null;
  let audioQueue = [];
  let isPlayingAudio = false;
  let activeAudioSource = null;
  let currentMode = 'normal';

  let alertBus = null;
  try {
    alertBus = new BroadcastChannel('city-sos-alerts');
  } catch (e) {
    console.warn('BroadcastChannel unavailable');
  }

  talkBtn.addEventListener('click', toggleVoiceSession);

  async function toggleVoiceSession() {
    if (isConnected) {
      stopVoiceSession();
    } else {
      await startVoiceSession();
    }
  }

  async function startVoiceSession() {
    talkStatusText.textContent = "Connecting to Gemini Live...";
    
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContext({ sampleRate: 24000 });

      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected to Hiren Voice Core');
        isConnected = true;
        updateUIState('connected');
        startMicCapture();
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        stopVoiceSession();
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        stopVoiceSession();
        talkStatusText.textContent = "Connection Error. Tap to retry.";
      };

    } catch (err) {
      console.error('Failed to start voice session:', err);
      talkStatusText.textContent = "Microphone Access Required";
      alert("Please allow microphone access to talk to City SOS.");
    }
  }

  function stopVoiceSession() {
    isConnected = false;
    
    if (micProcessor) {
      micProcessor.disconnect();
      micProcessor = null;
    }
    
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
    }

    if (ws) {
      ws.close();
      ws = null;
    }

    stopAudioPlayback();
    updateUIState('disconnected');
  }

  function startMicCapture() {
    const inputContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = inputContext.createMediaStreamSource(micStream);
    micProcessor = inputContext.createScriptProcessor(4096, 1, 1);
    
    micProcessor.onaudioprocess = (e) => {
      if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;

      const float32Array = e.inputBuffer.getChannelData(0);
      const pcm16Base64 = float32ToInt16Base64(float32Array);

      ws.send(JSON.stringify({
        type: 'audio',
        data: pcm16Base64
      }));
    };

    source.connect(micProcessor);
    micProcessor.connect(inputContext.destination);
  }

  function handleServerMessage(msg) {
    if (msg.type === 'status' && msg.status === 'connected') {
      updateUIState('listening');
    }
    else if (msg.type === 'audio') {
      updateUIState('speaking');
      enqueueAudioChunk(msg.data, msg.mimeType);
    }
    else if (msg.type === 'transcript') {
      appendTranscript(msg.role, msg.text);
      detectCoverKeywords(msg.text);
    }
    else if (msg.type === 'interrupted') {
      stopAudioPlayback();
      updateUIState('listening');
    }
    else if (msg.type === 'turn_complete') {
      updateUIState('listening');
    }
    else if (msg.type === 'escalation_triggered') {
      console.log('⚡ ESCALATION TRIGGERED SILENTLY!');
      currentMode = 'escalated';
      statusDot.className = 'status-dot escalated';
      statusLabel.textContent = 'Stealth Active Alert';
    }
    else if (msg.type === 'error') {
      console.error('Server error:', msg.message);
      talkStatusText.textContent = msg.message;
    }
  }

  function detectCoverKeywords(text) {
    const lower = text.toLowerCase();
    if (lower.includes('pizza') || lower.includes('order')) {
      if (currentMode !== 'escalated') {
        currentMode = 'cover';
        statusDot.className = 'status-dot cover-mode';
        statusLabel.textContent = 'Cover Conversation (Tony\'s Pizza)';
      }
    }
  }

  function enqueueAudioChunk(base64Data, mimeType) {
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const buffer = audioContext.createBuffer(1, float32Array.length, 24000);
    buffer.getChannelData(0).set(float32Array);

    audioQueue.push(buffer);
    if (!isPlayingAudio) {
      playNextAudioChunk();
    }
  }

  function playNextAudioChunk() {
    if (audioQueue.length === 0) {
      isPlayingAudio = false;
      if (isConnected) updateUIState('listening');
      return;
    }

    isPlayingAudio = true;
    const buffer = audioQueue.shift();
    activeAudioSource = audioContext.createBufferSource();
    activeAudioSource.buffer = buffer;
    activeAudioSource.connect(audioContext.destination);

    activeAudioSource.onended = () => {
      playNextAudioChunk();
    };

    activeAudioSource.start();
  }

  function stopAudioPlayback() {
    audioQueue = [];
    isPlayingAudio = false;
    if (activeAudioSource) {
      try { activeAudioSource.stop(); } catch(e) {}
      activeAudioSource = null;
    }
  }

  function float32ToInt16Base64(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  function updateUIState(state) {
    if (state === 'disconnected') {
      talkBtn.className = 'talk-btn';
      talkStatusText.textContent = "Tap to Connect Voice Companion";
      talkHint.textContent = "Ask for cooling centers, campus security, or talk naturally.";
      statusDot.className = 'status-dot';
      statusLabel.textContent = "Voice Disconnected";
      currentMode = 'normal';
    }
    else if (state === 'connected' || state === 'listening') {
      talkBtn.className = 'talk-btn listening';
      talkStatusText.textContent = "Listening... Speak naturally";
      talkHint.textContent = "Try asking about NYU Tandon security or say: 'I'd like to order a pizza'";
      if (currentMode === 'normal') {
        statusDot.className = 'status-dot active';
        statusLabel.textContent = "Gemini Live Active";
      }
    }
    else if (state === 'speaking') {
      talkBtn.className = 'talk-btn speaking';
      talkStatusText.textContent = "City SOS is speaking...";
    }
  }

  function appendTranscript(role, text) {
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
});
