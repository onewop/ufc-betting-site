FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy public/ so this_weeks_stats.json is available to the backend
COPY public/ ./public/

EXPOSE 8000

# Run from inside the backend folder so relative imports work
CMD ["sh", "-c", "cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000"]
