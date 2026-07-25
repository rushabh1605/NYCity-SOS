FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app ./app

# Set environment defaults
ENV PORT=8000
ENV HOST=0.0.0.0

EXPOSE 8000

# Run Uvicorn server dynamically reading PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
