#!/bin/bash
# start-dev.sh - One-click start for UFC Betting Site

echo "🚀 Starting UFC Betting Site - All Services"

# Activate venv
source .venv/bin/activate

echo "Starting Tailwind CSS watcher..."
npm run tailwind &

echo "Starting React frontend[](http://localhost:3000)..."
npm start &

echo "Starting FastAPI backend[](http://localhost:8000)..."
uvicorn backend.main:app --reload --port 8000 &

echo ""
echo "✅ All services started successfully!"
echo "   → Frontend: http://localhost:3000"
echo "   → Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for any process to exit
wait
