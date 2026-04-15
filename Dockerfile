FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code and public folder
COPY backend/ ./backend/
COPY public/ ./public/

EXPOSE 8000

# Use shell form so "cd" works
CMD cd /app/backend && uvicorn main:app --host 0.0.0.0 --port 8000
