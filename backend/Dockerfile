FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy public folder (this_weeks_stats.json) — this is the line that was missing
COPY public/ ./public/

EXPOSE 8000

# Run from the correct module path
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
