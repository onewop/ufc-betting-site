FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY public/ ./public/

# Set working directory inside backend so relative imports work
WORKDIR /app/backend

EXPOSE 8000

# Clean exec form - no shell, no cd
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
