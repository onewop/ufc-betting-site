#!/bin/bash

echo "🚀 Starting full UFC card update..."

# 1. Update CSV + highlights + missing video report
echo "📊 Updating fighter data and highlights..."
cd /home/onewop/ufc-betting-site-main
bash update-new-csv.sh

# 2. Build frontend
echo "🏗️  Building frontend..."
npm run build

# 3. Deploy to Vercel (using the fixed deploy logic)
echo "🌐 Deploying to Vercel..."
bash deploy.sh

echo "✅ Full update completed!"
echo "   Check the site in a few minutes."
