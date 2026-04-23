#!/bin/bash
# =============================================
# Build + Deploy to cagevault (Vercel)
# =============================================
# Usage:
#   ./deploy.sh          — full build then deploy
#   ./deploy.sh --no-build  — skip build, just deploy current build/
# =============================================

set -e
cd "$(dirname "$0")"

SKIP_BUILD=false
[[ "${1:-}" == "--no-build" ]] && SKIP_BUILD=true

# ── Step 1: Build ──────────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == "false" ]]; then
    echo "🔨 Building..."
    npm run build
fi

# ── Step 2: Restore the cagevault Vercel project config ────────────────────────
# npm run build wipes build/, so we keep the config here and restore it each time.
if [[ ! -f ".vercel-build/project.json" ]]; then
    echo "❌ .vercel-build/project.json not found — run: vercel link --project cagevault inside build/ once to regenerate it"
    exit 1
fi
mkdir -p build/.vercel
cp .vercel-build/project.json build/.vercel/project.json

# ── Step 3: Deploy ─────────────────────────────────────────────────────────────
echo "🚀 Deploying to cagevault.com..."
cd build
vercel deploy --prod --yes

echo ""
echo "✅ Done — cagevault.com updated."

echo ""
echo "✅ Deployment completed successfully!"
echo "🔗 Live site: https://cagevault.com/fight-analyzer"
echo "💡 Tip: Hard refresh with Ctrl + Shift + R (or Cmd + Shift + R)"
