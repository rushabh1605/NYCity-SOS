/**
 * City SOS Gemini Live Voice Engine Adapter
 * Handles Web Audio API PCM microphone capture, WebSocket streaming to /ws/live,
 * 24kHz PCM audio playback queueing, interruption management, and UI callbacks.
 */
export class VoiceAdapter {
  constructor(options = {}) {
    this.options = options;
    this.handlers = {
      onConnected: options.onConnected || (() => {}),
      onDisconnected: options.onDisconnected || (() => {}),
      onListening: options.onListening || (() => {}),
      onSpeaking: options.onSpeaking || (() => {}),
      onUserTranscript: options.onUserTranscript || (() => {}),
      onAssistantTranscript: options.onAssistantTranscript || (() => {}),
      onCoverModeEntered: options.onCoverModeEntered || (() => {}),
      onToolCall: options.onToolCall || (() => {}),
      onError: options.onError || (() => {})
    };

    this.ws = null;
    this.isConnected = false;
    this.audioContext = null;
    this.micStream = null;
    this.micProcessor = null;
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.activeAudioSource = null;
    this.currentMode = 'normal'; // 'normal' | 'cover'
    this.state = 'idle';
  }

  async connect() {
    this.state = 'connecting';
    
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to City SOS Gemini Live WebSocket');
        this.isConnected = true;
        this.state = 'listening';
        this.handlers.onConnected();
        this.handlers.onListening();
        this._startMicCapture();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleServerMessage(msg);
        } catch (e) {
          console.error('Error parsing server message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.disconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        this.disconnect();
        this.handlers.onError('WebSocket connection error');
      };

    } catch (err) {
      console.error('Failed to start voice session:', err);
      this.disconnect();
      this.handlers.onError('Microphone access required');
    }
  }

  disconnect() {
    this.isConnected = false;
    this.state = 'idle';

    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._stopAudioPlayback();
    this.handlers.onDisconnected();
  }

  _startMicCapture() {
    try {
      const inputContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = inputContext.createMediaStreamSource(this.micStream);
      this.micProcessor = inputContext.createScriptProcessor(4096, 1, 1);

      this.micProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const float32Array = e.inputBuffer.getChannelData(0);
        const pcm16Base64 = this._float32ToInt16Base64(float32Array);

        this.ws.send(JSON.stringify({
          type: 'audio',
          data: pcm16Base64
        }));
      };

      source.connect(this.micProcessor);
      this.micProcessor.connect(inputContext.destination);
    } catch (e) {
      console.warn('Microphone audio capture error:', e);
    }
  }

  _handleServerMessage(msg) {
    if (msg.type === 'status' && msg.status === 'connected') {
      this.state = 'listening';
      this.handlers.onListening();
    }
    else if (msg.type === 'audio') {
      this.state = 'speaking';
      this.handlers.onSpeaking();
      this._enqueueAudioChunk(msg.data, msg.mimeType);
    }
    else if (msg.type === 'transcript') {
      this.handlers.onAssistantTranscript(msg.text);
      this._detectCoverKeywords(msg.text);
    }
    else if (msg.type === 'interrupted') {
      this._stopAudioPlayback();
      this.state = 'listening';
      this.handlers.onListening();
    }
    else if (msg.type === 'turn_complete') {
      this.state = 'listening';
      this.handlers.onListening();
    }
    else if (msg.type === 'escalation_triggered') {
      console.log('⚡ ESCALATION TRIGGERED SILENTLY via Gemini Live');
      this.handlers.onToolCall('trigger_escalation', msg.payload || {});
    }
    else if (msg.type === 'error') {
      console.error('Server error:', msg.message);
      this.handlers.onError(msg.message);
    }
  }

  _detectCoverKeywords(text) {
    if (!text) return;
    const lower = text.toLowerCase();
    if (lower.includes('pizza') || lower.includes('order')) {
      if (this.currentMode !== 'cover') {
        this.currentMode = 'cover';
        this.handlers.onCoverModeEntered();
      }
    }
  }

  _enqueueAudioChunk(base64Data, mimeType) {
    if (!this.audioContext) return;

    try {
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

      const buffer = this.audioContext.createBuffer(1, float32Array.length, 24000);
      buffer.getChannelData(0).set(float32Array);

      this.audioQueue.push(buffer);
      if (!this.isPlayingAudio) {
        this._playNextAudioChunk();
      }
    } catch (e) {
      console.warn('Audio decoding error:', e);
    }
  }

  _playNextAudioChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      if (this.isConnected) {
        this.state = 'listening';
        this.handlers.onListening();
      }
      return;
    }

    this.isPlayingAudio = true;
    const buffer = this.audioQueue.shift();
    this.activeAudioSource = this.audioContext.createBufferSource();
    this.activeAudioSource.buffer = buffer;
    this.activeAudioSource.connect(this.audioContext.destination);

    this.activeAudioSource.onended = () => {
      this._playNextAudioChunk();
    };

    this.activeAudioSource.start();
  }

  _stopAudioPlayback() {
    this.audioQueue = [];
    this.isPlayingAudio = false;
    if (this.activeAudioSource) {
      try { this.activeAudioSource.stop(); } catch (e) {}
      this.activeAudioSource = null;
    }
  }

  _float32ToInt16Base64(float32Array) {
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

  // --- Stubs for ?dev=1 simulation ---
  simulateUserSpeech(text) {
    this.handlers.onUserTranscript(text);
  }

  simulateAssistantSpeech(text) {
    this.state = 'speaking';
    this.handlers.onSpeaking();
    this.handlers.onAssistantTranscript(text);
    setTimeout(() => {
      this.state = 'listening';
      this.handlers.onListening();
    }, 1500);
  }

  setCoverMode() {
    this.currentMode = 'cover';
    this.handlers.onCoverModeEntered();
  }

  triggerToolCall(name, args) {
    this.handlers.onToolCall(name, args);
  }
}
