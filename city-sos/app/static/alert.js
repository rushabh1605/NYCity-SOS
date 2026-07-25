// City SOS — Dispatch Dashboard Monitor Script
document.addEventListener('DOMContentLoaded', () => {
    // DOM Element Declarations
    const standbyView = document.getElementById('standby-view');
    const alertView = document.getElementById('alert-view');
    const connStatus = document.getElementById('connection-status');
    const connText = document.getElementById('conn-text');
    const alertSound = document.getElementById('alert-sound');

    // Timer and map state trackers
    let map = null;
    let marker = null;
    let timerInterval = null;
    let alertStartTime = null;
    let eventSource = null;

    // Listen on local BroadcastChannel for same-origin browser tab updates
    try {
        const localBus = new BroadcastChannel('city-sos-alerts');
        localBus.onmessage = (e) => {
            console.log('Received BroadcastChannel message:', e.data);
            if (e.data.action === 'clear') {
                resetToStandby();
            } else {
                handleIncomingAlert(e.data);
            }
        };
    } catch (bcErr) {
        console.warn('BroadcastChannel not supported:', bcErr);
    }

    /**
     * Initializes the Leaflet.js interactive map.
     * OSM Tiles are inverted using CSS rules in alert_styles.css.
     */
    function initMap(lat, lng) {
        if (!map) {
            map = L.map('map', {
                zoomControl: true,
                attributionControl: false
            }).setView([lat, lng], 16);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(map);
        } else {
            map.setView([lat, lng], 16);
        }

        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng]).addTo(map);
        }
    }

    /**
     * Starts the elapsed stopwatch timer counting up since dispatch timestamp
     */
    function startTimer(timestampStr) {
        stopTimer();
        alertStartTime = timestampStr ? new Date(timestampStr) : new Date();
        
        // Safety check if timestamp is corrupted
        if (isNaN(alertStartTime.getTime())) {
            alertStartTime = new Date();
        }

        const timerCounter = document.getElementById('timer-counter');

        timerInterval = setInterval(() => {
            const now = new Date();
            const diffMs = now - alertStartTime;
            const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
            
            const mins = String(Math.floor(diffSecs / 60)).padStart(2, '0');
            const secs = String(diffSecs % 60).padStart(2, '0');
            timerCounter.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        document.getElementById('timer-counter').textContent = "00:00";
    }

    /**
     * Renders the alert fields, applies dynamic styling, and instantiates maps.
     */
    function handleIncomingAlert(data) {
        console.log('Rendering Incoming Alert Payload:', data);

        // Sound chime cue
        try {
            if (alertSound) alertSound.play();
        } catch (e) {
            console.warn('Audio play blocked or unavailable');
        }

        // Fast transition (< 150ms)
        if (standbyView) standbyView.style.display = 'none';
        if (alertView) alertView.style.display = 'flex';

        // 1. Urgency Banner
        const statusBanner = document.getElementById('status-banner');
        const urgencyBadge = document.getElementById('alert-urgency-badge');
        const urgency = (data.urgency || 'immediate').toLowerCase();
        
        if (statusBanner && urgencyBadge) {
            if (urgency === 'immediate') {
                statusBanner.className = 'status-banner immediate';
                urgencyBadge.textContent = 'ALERT DISPATCHED';
            } else {
                statusBanner.className = 'status-banner standard';
                urgencyBadge.textContent = 'STANDARD BEACON';
            }
        }

        // 2. Incident ID
        const idEl = document.getElementById('display-incident-id');
        if (idEl) {
            idEl.textContent = `INCIDENT ID: ${data.alert_id ? data.alert_id.substring(0, 8) : 'AUTO'}`;
        }

        // 3. User details
        const user = data.user || {};
        document.getElementById('user-name').textContent = user.name || 'Unknown Subject';
        document.getElementById('user-phone').textContent = user.phone || 'Unknown Contact';
        document.getElementById('user-campus').textContent = user.campus || 'N/A';

        // 4. People present
        const people = data.people_present;
        const peoplePresentEl = document.getElementById('people-present');
        const peopleRow = document.getElementById('people-present-row');
        if (peoplePresentEl && peopleRow) {
            if (people !== undefined && people !== null && people > 0) {
                peoplePresentEl.textContent = people;
                peopleRow.style.opacity = '1';
            } else {
                peoplePresentEl.textContent = '0 / Unspecified';
                peopleRow.style.opacity = '0.4';
            }
        }

        // 5. Location hints
        const hint = data.location_hint;
        const hintRow = document.getElementById('location-hint-row');
        if (hintRow) {
            if (hint) {
                document.getElementById('location-hint').textContent = hint;
                hintRow.style.display = 'flex';
            } else {
                hintRow.style.display = 'none';
            }
        }

        // 6. Situation Inferred Summary
        const summaryEl = document.getElementById('situation-summary');
        if (summaryEl) {
            summaryEl.textContent = data.situation_summary || 'No summary available.';
        }

        // 7. Location Map Rendering
        const loc = data.location || {};
        const labelEl = document.getElementById('location-label');
        if (labelEl) {
            labelEl.textContent = loc.label || 'Unknown Location';
        }
        
        const lat = parseFloat(loc.lat) || 40.6942;
        const lng = parseFloat(loc.lng) || -73.9865;
        initMap(lat, lng);

        // 8. Monospace Transcript Parser
        const transcriptConsole = document.getElementById('transcript-console');
        if (transcriptConsole) {
            transcriptConsole.innerHTML = '';
            const tail = data.transcript_tail || [];
            
            if (tail.length === 0) {
                transcriptConsole.innerHTML = '<div class="transcript-line" style="color: var(--text-muted)">No active conversation logs.</div>';
            } else {
                tail.forEach(line => {
                    const lineDiv = document.createElement('div');
                    
                    if (line.toLowerCase().startsWith('user:')) {
                        lineDiv.className = 'transcript-line user';
                        lineDiv.innerHTML = `<span class="transcript-speaker">USER:</span> <span>${escapeHtml(line.substring(5).trim())}</span>`;
                    } else if (line.toLowerCase().startsWith('agent:') || line.toLowerCase().startsWith('assistant:')) {
                        lineDiv.className = 'transcript-line agent';
                        const prefixLength = line.toLowerCase().startsWith('agent:') ? 6 : 10;
                        lineDiv.innerHTML = `<span class="transcript-speaker">AGENT:</span> <span>${escapeHtml(line.substring(prefixLength).trim())}</span>`;
                    } else {
                        lineDiv.className = 'transcript-line';
                        lineDiv.textContent = line;
                    }
                    transcriptConsole.appendChild(lineDiv);
                });
            }
            transcriptConsole.scrollTop = transcriptConsole.scrollHeight;
        }

        // Start elapsed timer
        startTimer(data.timestamp);
    }

    function resetToStandby() {
        stopTimer();
        if (standbyView) standbyView.style.display = 'flex';
        if (alertView) alertView.style.display = 'none';
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Persistent Server-Sent Events (SSE) stream listener
     */
    function connectSSE() {
        if (eventSource) {
            eventSource.close();
        }

        // Connect to Hiren's unified SSE path
        eventSource = new EventSource('/api/alerts/stream');

        eventSource.onopen = () => {
            console.log('SSE Stream Connected successfully');
            if (connStatus && connText) {
                connStatus.className = 'conn-status online';
                connText.textContent = 'CONNECTED';
            }
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.action === 'clear') {
                    resetToStandby();
                } else if (data && data.alert_id) {
                    handleIncomingAlert(data);
                }
            } catch (e) {
                console.error("Error parsing message payload:", e);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE Stream Error:', err);
            if (connStatus && connText) {
                connStatus.className = 'conn-status offline';
                connText.textContent = 'RECONNECTING...';
            }
            eventSource.close();
            setTimeout(connectSSE, 3000);
        };
    }

    // Auto trigger mock alert parameter checking
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === '1') {
        console.log('Demo mode active: Sending mock trigger request...');
        setTimeout(() => {
            fetch('/api/alerts/trigger-demo', {
                method: 'POST'
            })
            .then(res => res.json())
            .then(data => console.log('Mock Alert Triggered:', data))
            .catch(err => console.error('Error triggering mock:', err));
        }, 2000);
    }

    // Start SSE on page ready
    connectSSE();
});
