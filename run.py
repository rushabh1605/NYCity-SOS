import os
import sys
import uvicorn

# Ensure city-sos is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "city-sos")))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 Starting City SOS Integrated Master Server on http://localhost:{port}")
    print(f"📱 Main UI Shell: http://localhost:{port}/")
    print(f"🚨 Dispatch Monitor Screen: http://localhost:{port}/alert")
    print(f"⚙️ Health Status: http://localhost:{port}/health")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
