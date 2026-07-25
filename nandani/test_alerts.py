"""
City SOS Dispatch Screen Test & Validation Runner
=================================================
This testing script runs a sequential diagnostic check by simulating
voice assistant client outputs and sending payloads directly to the
FastAPI endpoint. It covers positive flows and negative/boundary cases
to verify dashboard resilience.

This script runs interactively so you can verify each visual transition
on the dashboard step-by-step.
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def send_alert(name, payload):
    """
    Utility helper to post a JSON payload to the emergency alert endpoint
    and print status diagnostics.
    """
    try:
        response = requests.post(f"{BASE_URL}/api/alert", json=payload)
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Content: {response.json()}")
    except Exception as e:
        print(f"\nCould not connect to FastAPI server at {BASE_URL}: {e}")
        print("Please make sure the server is running with: python3.8 nandani/main.py")

if __name__ == "__main__":
    print("=" * 60)
    print("           City SOS Alert Verification Console")
    print("=" * 60)
    print("Make sure you have open in your browser: http://127.0.0.1:8000")
    print("Verify that the status indicates: MONITORING ACTIVE (pulsing green)\n")

    # ==========================================
    # 1. POSITIVE TEST: VALID IMMEDIATE ALERT
    # ==========================================
    input("Press ENTER to trigger -> Test Case 1: Positive Immediate Alert...")
    print("Sending payload...")
    send_alert("Positive Case - Valid Immediate Alert", {
        "alert_id": "test-immediate-123",
        "urgency": "immediate",
        "user": {
            "name": "Nandani B.",
            "phone": "+1 (555) 019-9988",
            "campus": "NYU Tandon"
        },
        "location": {
            "lat": 40.6942,
            "lng": -73.9865,
            "label": "5 MetroTech Center, Brooklyn, NY 11201"
        },
        "situation_summary": "Caller indicated unsafe situation with multiple bystanders.",
        "people_present": 3,
        "location_hint": "Second floor of Metrotech lobby",
        "transcript_tail": [
            "user: Can I order two large pizzas?",
            "agent: Sure, what style?",
            "user: Double cheese, and extra pineapple please.",
            "agent: Got it, extra pineapple."
        ]
    })
    print("\n[Visual Check] Dashboard should have transitioned immediately to FLASHING RED.")
    print("Leaflet map should point to NYU Tandon (5 Metrotech). Elapsed timer is active.\n")

    # ==========================================
    # 2. POSITIVE TEST: STANDARD URGENCY ALERT
    # ==========================================
    input("Press ENTER to trigger -> Test Case 2: Positive Standard Urgency Alert...")
    print("Sending payload...")
    send_alert("Positive Case - Standard Urgency Alert", {
        "alert_id": "test-standard-456",
        "urgency": "standard",
        "user": {
            "name": "Jane Doe",
            "phone": "+1 (555) 123-4567",
            "campus": "General NYC"
        },
        "location": {
            "lat": 40.7128,
            "lng": -74.0060,
            "label": "City Hall Park, New York, NY 10007"
        },
        "situation_summary": "Standard check-in request with location updates.",
        "people_present": 0,
        "transcript_tail": [
            "user: I'm heading out now.",
            "agent: Keep safe, let me know when you arrive."
        ]
    })
    print("\n[Visual Check] Dashboard should transition to a calm AMBER theme (STANDARD BEACON).")
    print("Leaflet map should pan to City Hall Park.\n")

    # ==========================================
    # 3. NEGATIVE TEST: MISSING GPS COORDINATES
    # ==========================================
    input("Press ENTER to trigger -> Test Case 3: Negative Case (Missing GPS Coords)...")
    print("Sending payload...")
    send_alert("Negative Case - Missing GPS Coords", {
        "alert_id": "test-missing-gps",
        "urgency": "immediate",
        "user": {
            "name": "Alex Smith",
            "phone": "+1 (555) 987-6543",
            "campus": "NYU Brooklyn"
        },
        "location": {
            "label": "Somewhere in Brooklyn"
            # lat and lng keys are intentionally omitted
        },
        "situation_summary": "Missing coordinates test. Fallback default map centered at NYU Tandon should render.",
        "people_present": 1
    })
    print("\n[Visual Check] Dashboard must remain stable and NOT crash.")
    print("Leaflet map should default to NYU Tandon coordinates.\n")

    # ==========================================
    # 4. NEGATIVE TEST: ENTIRELY OMITTED FIELDS
    # ==========================================
    input("Press ENTER to trigger -> Test Case 4: Negative Case (Entirely Omitted Fields)...")
    print("Sending payload...")
    send_alert("Negative Case - Omitted Fields", {
        "alert_id": "test-omitted-fields",
        "urgency": "immediate",
        "user": {
            "name": "Quiet Caller"
        }
        # location, transcript, people_present, urgency parameters are entirely omitted
    })
    print("\n[Visual Check] Dashboard must remain stable and NOT crash.")
    print("Verify missing details are dimmed/hidden gracefully, and logs display placeholder text.\n")

    # ==========================================
    # 5. CLEAR / RESET TO STANDBY
    # ==========================================
    input("Press ENTER to finish testing and Reset Screen back to Standby...")
    try:
        response = requests.post(f"{BASE_URL}/api/clear")
        print(f"\nStatus Code: {response.status_code}")
        print("Clear signal sent. Screen returned to standby mode.")
    except Exception as e:
        print(f"Could not connect to FastAPI server to clear: {e}")

    print("\nTest execution finished successfully.")
