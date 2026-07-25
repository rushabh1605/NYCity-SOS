import os
import sys
import uvicorn

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 Starting Hiren's Voice Core Server on http://localhost:{port}")
    print(f"📱 Main UI: http://localhost:{port}/")
    print(f"🚨 Alert Screen: http://localhost:{port}/alert")
    uvicorn.run("hiren.app.main:app", host="0.0.0.0", port=port, reload=True)
