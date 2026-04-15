FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend code
COPY backend/ /app/backend/

# Copy the public folder (this_weeks_stats.json lives here)
# Important: Use ../public because Dockerfile is in backend/
COPY ../public/ /app/public/

EXPOSE 8000

# Correct uvicorn command - run from the backend module
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
