// Nandani's Alert Display Screen Logic (BroadcastChannel & SSE EventSource)
document.addEventListener('DOMContentLoaded', () => {
  const alertBanner = document.getElementById('alertBanner');
  const mainPanel = document.getElementById('mainPanel');
  const secondaryPanel = document.getElementById('secondaryPanel');
  const stopwatch = document.getElementById('stopwatch');
  const situationSummary = document.getElementById('situationSummary');
  const userName = document.getElementById('userName');
  const userPhone = document.getElementById('userPhone');
  const userCampus = document.getElementById('userCampus');
  const peopleCount = document.getElementById('peopleCount');
  const locationHint = document.getElementById('locationHint');
  const locationLabel = document.getElementById('locationLabel');
  const transcriptTail = document.getElementById('transcriptTail');

  let alertTime = null;
  let timerInterval = null;

  function renderAlert(alertData) {
    if (!alertData) return;

    console.log('Rendering Alert Data:', alertData);

    const urgencyText = (alertData.urgency || 'IMMEDIATE').toUpperCase();
    alertBanner.textContent = `ALERT DISPATCHED — ${urgencyText} URGENCY`;
    alertBanner.className = 'alert-header-banner active';

    mainPanel.classList.add('active-border');
    secondaryPanel.classList.add('active-border');

    situationSummary.textContent = alertData.situation_summary || "Emergency situation reported in cover mode.";
    
    if (alertData.user) {
      userName.textContent = alertData.user.name || "Rushabh P.";
      userPhone.textContent = alertData.user.phone || "+1 (201) 555-0142";
      userCampus.textContent = alertData.user.campus || "NYU Tandon";
    }

    peopleCount.textContent = Number.isInteger(alertData.people_present) ? alertData.people_present : (alertData.people_present ?? 0);
    locationHint.textContent = `Location hint: ${alertData.location_hint || 'None provided'}`;

    if (alertData.location) {
      locationLabel.textContent = alertData.location.label || "5 MetroTech Center, Brooklyn, NY 11201";
    }

    if (Array.isArray(alertData.transcript_tail) && alertData.transcript_tail.length > 0) {
      transcriptTail.innerHTML = alertData.transcript_tail
        .map(line => `<div>${escapeHtml(line)}</div>`)
        .join('');
    } else {
      transcriptTail.innerHTML = '<div>user: I\'d like to order a pizza</div><div>agent: Sure — how many?</div><div>user: Three, please. Extra cheese.</div><div>agent: Got it. Delivery or pickup?</div><div>user: Delivery. And extra pineapple on that.</div>';
    }

    if (alertData.timestamp) {
      alertTime = new Date(alertData.timestamp);
    } else {
      alertTime = new Date();
    }

    if (timerInterval) clearInterval(timerInterval);
    updateStopwatch();
    timerInterval = setInterval(updateStopwatch, 1000);
  }

  function updateStopwatch() {
    if (!alertTime) return;
    const now = new Date();
    const elapsedSeconds = Math.max(0, Math.floor((now - alertTime) / 1000));
    const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    stopwatch.textContent = `${mins}:${secs}`;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 1. BroadcastChannel Listener (Same-Origin)
  try {
    const bus = new BroadcastChannel('city-sos-alerts');
    bus.onmessage = (event) => {
      console.log('Received BroadcastChannel message on alert page:', event.data);
      renderAlert(event.data);
    };
  } catch (err) {
    console.warn('BroadcastChannel not available on alert page:', err);
  }

  // 2. Server-Sent Events (SSE) Listener (Backend fallback / Cross-device stream)
  try {
    const sse = new EventSource('/api/alerts/stream');
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.alert_id) {
          console.log('Received SSE alert stream message:', data);
          renderAlert(data);
        }
      } catch (e) {}
    };
  } catch (sseErr) {
    console.warn('SSE EventSource unavailable:', sseErr);
  }

  // 3. ?demo=1 query parameter trigger
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === '1') {
    setTimeout(() => {
      fetch('/api/alerts/trigger-demo')
        .then(res => res.json())
        .then(data => renderAlert(data.alert))
        .catch(err => console.error('Demo trigger failed:', err));
    }, 2000);
  }
});
