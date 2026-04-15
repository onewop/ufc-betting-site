FROM python:3.11-slim

WORKDIR /app

# Install dependencies from backend/requirements.txt (build context = repo root)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy public/ from repo root — this_weeks_stats.json lives at /app/public/this_weeks_stats.json
COPY public/ ./public/

EXPOSE 8000

# cd into backend/ so bare imports (database, routers.*) resolve correctly
# Shell form required to expand Railway's $PORT at runtime
CMD ["sh", "-c", "cd /app/backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
