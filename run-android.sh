#!/bin/bash
echo "🚀 UFC Betting App - Starting Android Build..."

# Activate venv if it exists
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
fi

echo "📦 Building frontend..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "🔄 Syncing to Android..."
npx cap sync android

if [ $? -ne 0 ]; then
  echo "❌ Sync failed!"
  exit 1
fi

echo "✅ Ready! Launching Android Studio..."
flatpak run com.google.AndroidStudio
