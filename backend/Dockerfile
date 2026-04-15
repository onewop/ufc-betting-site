FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project
COPY . .

# Explicitly copy public/ so the backend can read this_weeks_stats.json at runtime
# This is required because Railway Docker builds don't automatically expose frontend static files to the backend
COPY public/ /app/public/

EXPOSE 8000

# Most reliable CMD for Railway
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
