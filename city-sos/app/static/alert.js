// Nandani's Multi-Session Dispatch Center Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
  const alertBanner = document.getElementById('alertBanner');
  const bannerText = document.getElementById('bannerText');
  const activeCountBadge = document.getElementById('activeCountBadge');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const standbyView = document.getElementById('standbyView');
  const alertsContainer = document.getElementById('alertsContainer');
  const demoTriggerBtn = document.getElementById('demoTriggerBtn');

  // Map of alert_id -> { alertData, timerInterval, startTime }
  const activeAlertsMap = new Map();

  function renderDashboard() {
    const alertList = Array.from(activeAlertsMap.values());
    const count = alertList.length;

    if (count === 0) {
      // Standby state
      alertBanner.className = 'alert-header-banner standby';
      bannerText.textContent = 'MONITORING — NO ACTIVE ALERTS';
      activeCountBadge.style.display = 'none';
      clearAllBtn.style.display = 'none';
      standbyView.style.display = 'flex';
      alertsContainer.style.display = 'none';
      alertsContainer.innerHTML = '';
      return;
    }

    // Active Alerts State
    alertBanner.className = 'alert-header-banner active';
    bannerText.textContent = `ALERT DISPATCH CENTER — ${count} ACTIVE INCIDENT${count > 1 ? 'S' : ''}`;
    activeCountBadge.style.display = 'inline-block';
    activeCountBadge.textContent = `${count} ACTIVE`;
    clearAllBtn.style.display = 'inline-block';
    standbyView.style.display = 'none';
    alertsContainer.style.display = 'grid';

    // Render cards
    alertsContainer.innerHTML = '';
    alertList.forEach(({ alertData, startTime }) => {
      const cardEl = createAlertCardElement(alertData, startTime);
      alertsContainer.appendChild(cardEl);
    });
  }

  function addOrUpdateAlert(alertData) {
    if (!alertData || !alertData.alert_id) return;
    const alertId = alertData.alert_id;

    if (!activeAlertsMap.has(alertId)) {
      const startTime = alertData.timestamp ? new Date(alertData.timestamp) : new Date();
      activeAlertsMap.set(alertId, {
        alertData,
        startTime,
        timerInterval: null
      });
    } else {
      activeAlertsMap.get(alertId).alertData = alertData;
    }

    renderDashboard();
    startStopwatches();
  }

  function removeAlert(alertId) {
    if (activeAlertsMap.has(alertId)) {
      const item = activeAlertsMap.get(alertId);
      if (item.timerInterval) clearInterval(item.timerInterval);
      activeAlertsMap.delete(alertId);
      renderDashboard();
    }
  }

  function clearAllAlerts() {
    activeAlertsMap.forEach(item => {
      if (item.timerInterval) clearInterval(item.timerInterval);
    });
    activeAlertsMap.clear();
    renderDashboard();
    fetch('/api/alerts/clear', { method: 'POST' }).catch(() => {});
  }

  function startStopwatches() {
    activeAlertsMap.forEach((item, alertId) => {
      if (item.timerInterval) clearInterval(item.timerInterval);
      
      const updateTimer = () => {
        const timerEl = document.getElementById(`timer-${alertId}`);
        if (!timerEl) return;
        const now = new Date();
        const elapsed = Math.floor((now - item.startTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
      };

      updateTimer();
      item.timerInterval = setInterval(updateTimer, 1000);
    });
  }

  function createAlertCardElement(alertData, startTime) {
    const card = document.createElement('div');
    const urgency = (alertData.urgency || 'immediate').toLowerCase();
    card.className = `alert-card-grid ${urgency === 'immediate' ? 'urgency-immediate' : 'urgency-standard'}`;
    card.id = `card-${alertData.alert_id}`;

    const user = alertData.user || {};
    const location = alertData.location || {};
    const transcriptLines = Array.isArray(alertData.transcript_tail) ? alertData.transcript_tail : [];

    const mapSvg = generateVectorMapSvg(
      location.label || "5 MetroTech Center, Brooklyn, NY",
      location.lat || 40.6942,
      location.lng || -73.9865
    );

    const transcriptHtml = transcriptLines.length > 0
      ? transcriptLines.map(line => `<div>${escapeHtml(line)}</div>`).join('')
      : '<div>user: I\'d like to order a pizza</div><div>agent: Sure — how many?</div><div>user: Three, please. Extra cheese.</div><div>agent: Got it. Delivery or pickup?</div><div>user: Delivery. And extra pineapple on that.</div>';

    card.innerHTML = `
      <div class="card-header">
        <div class="card-title-group">
          <span class="card-status-badge ${urgency}">${urgency.toUpperCase()} URGENCY</span>
          <span class="card-id">ID: ${alertData.alert_id.substring(0, 8)}</span>
        </div>
        <button class="dismiss-card-btn" data-id="${alertData.alert_id}" title="Dismiss Alert">✕ Dismiss</button>
      </div>

      <div class="card-body">
        <!-- Left Section: Meta & Summary -->
        <div class="card-section">
          <div class="timer-box">
            <div>
              <div class="timer-label">INCIDENT DURATION</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.1rem;">Live Stopwatch</div>
            </div>
            <div class="timer-count" id="timer-${alertData.alert_id}">00:00</div>
          </div>

          <div>
            <div class="info-label">PRIMARY INFERRED SITUATION</div>
            <div class="summary-box">
              ${escapeHtml(alertData.situation_summary || "Emergency situation reported in cover mode.")}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <div class="info-label">USER PROFILE</div>
              <div class="info-val-large">${escapeHtml(user.name || "Rushabh P.")}</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(user.phone || "+1 (201) 555-0142")}</div>
              <div style="font-size: 0.85rem; color: var(--accent-cyan); font-weight: 600; margin-top: 0.2rem;">${escapeHtml(user.campus || "NYU Tandon")}</div>
            </div>
            <div>
              <div class="info-label">PEOPLE PRESENT</div>
              <div class="info-val-large" style="font-size: 2.2rem; color: var(--accent-amber);">
                ${alertData.people_present ?? 0}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Hint: ${escapeHtml(alertData.location_hint || 'None')}</div>
            </div>
          </div>
        </div>

        <!-- Right Section: Vector Map & Transcript -->
        <div class="card-section">
          <div>
            <div class="info-label">INCIDENT LOCATION MAP</div>
            ${mapSvg}
          </div>

          <div>
            <div class="info-label">DISGUISED CONVERSATION LOG</div>
            <div class="transcript-tail-box">
              ${transcriptHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    // Wire dismiss button
    const dismissBtn = card.querySelector('.dismiss-card-btn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        const id = dismissBtn.getAttribute('data-id');
        removeAlert(id);
        fetch(`/api/alerts/dismiss/${id}`, { method: 'POST' }).catch(() => {});
      });
    }

    return card;
  }

  function generateVectorMapSvg(label, lat, lng) {
    return `
      <div class="vector-map-wrapper">
        <svg viewBox="0 0 400 150" class="vector-map-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="150" fill="#090d16" rx="8"/>
          <!-- Grid Lines -->
          <line x1="0" y1="30" x2="400" y2="30" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
          <line x1="0" y1="75" x2="400" y2="75" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
          <line x1="0" y1="120" x2="400" y2="120" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
          <line x1="100" y1="0" x2="100" y2="150" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
          <line x1="200" y1="0" x2="200" y2="150" stroke="rgba(6,182,212,0.25)" stroke-width="2"/>
          <line x1="300" y1="0" x2="300" y2="150" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>

          <!-- East River Contour -->
          <path d="M0,0 Q70,35 140,15 T240,0 L0,0 Z" fill="rgba(6,182,212,0.12)" stroke="rgba(6,182,212,0.3)"/>
          <text x="12" y="18" fill="rgba(6,182,212,0.6)" font-size="10" font-family="sans-serif" font-weight="700">EAST RIVER</text>
          <text x="210" y="22" fill="#94a3b8" font-size="10" font-family="sans-serif" font-weight="600">Jay St — MetroTech</text>

          <!-- Radar Ripples & Red Pin -->
          <circle cx="200" cy="80" r="28" fill="rgba(239,68,68,0.12)"/>
          <circle cx="200" cy="80" r="16" fill="rgba(239,68,68,0.25)"/>
          <circle cx="200" cy="80" r="8" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
        </svg>

        <div class="map-badge-overlay">
          <div style="font-weight: 700; color: #f8fafc; font-size: 0.85rem;">📍 ${escapeHtml(label)}</div>
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-cyan); margin-top: 0.15rem;">${lat.toFixed(4)}° N, ${lng.toFixed(4)}° W</div>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Clear All Button Listener
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllAlerts);
  }

  // Demo Trigger Button Listener
  if (demoTriggerBtn) {
    demoTriggerBtn.addEventListener('click', () => {
      fetch('/api/alerts/trigger-demo')
        .then(res => res.json())
        .then(data => {
          if (data && data.alert) {
            addOrUpdateAlert(data.alert);
          }
        })
        .catch(err => console.error('Demo trigger error:', err));
    });
  }

  // BroadcastChannel Listener (Same-origin windows)
  try {
    const bus = new BroadcastChannel('city-sos-alerts');
    bus.onmessage = (e) => {
      console.log('Received BroadcastChannel alert:', e.data);
      if (e.data) {
        addOrUpdateAlert(e.data);
      }
    };
  } catch (err) {
    console.warn('BroadcastChannel error:', err);
  }

  // Server-Sent Events (SSE) Listener (Cross-device support)
  try {
    const sse = new EventSource('/api/alerts/stream');
    sse.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.action === 'initial_state' || msg.action === 'clear_all') {
          if (Array.isArray(msg.all_alerts)) {
            activeAlertsMap.clear();
            msg.all_alerts.forEach(a => addOrUpdateAlert(a));
            renderDashboard();
          }
        }
        else if (msg.action === 'new_alert' && msg.alert) {
          addOrUpdateAlert(msg.alert);
        }
        else if (msg.alert_id) {
          addOrUpdateAlert(msg);
        }
      } catch (parseErr) {}
    };
  } catch (sseErr) {
    console.warn('SSE Error:', sseErr);
  }
});
