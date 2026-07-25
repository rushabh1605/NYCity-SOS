# Use official Python runtime as base image
FROM python:3.10-slim

# Set working directory inside container
WORKDIR /app

# Prevent Python from writing .pyc files and enable buffer logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Install system dependencies (curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files into the container working directory
COPY . .

# Expose target application port
EXPOSE 8080

# Command to run uvicorn server in production using the master runner
CMD ["python", "run.py"]
