#!/bin/bash
# =============================================
# Safe & Reliable Deploy Script for cagevault
# =============================================

echo "🚀 Starting safe deployment to cagevault..."

# Go to project root
cd "$(dirname "$0")" || exit 1

# Clean any previous bad link (this prevents creating "build" project)
echo "🧹 Cleaning old Vercel link..."
rm -rf .vercel

# Check build folder
if [ ! -d "build" ]; then
  echo "❌ Error: 'build' folder not found!"
  echo "   Please run 'npm run build' first."
  exit 1
fi

cd build

echo "🔗 Linking to cagevault project..."
# Force link to the correct project (this is the key fix)
vercel link --yes --project cagevault

echo "📦 Deploying static files to production..."
vercel deploy --prod --yes

echo ""
echo "✅ Deployment completed successfully!"
echo "🔗 Live site: https://cagevault.com/fight-analyzer"
echo "💡 Tip: Hard refresh with Ctrl + Shift + R (or Cmd + Shift + R)"
