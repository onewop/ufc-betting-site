#!/bin/bash

echo "🚀 UFC Weekly Update - Full Stack Refresh"
echo "============================================="

# =======================
# 1. Confirmation
# =======================
read -p "⚠️  This will update CSV, highlights, commit git, push backend (Railway), and deploy frontend. Continue? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "❌ Update cancelled."
    exit 1
fi

# =======================
# 2. Update data (CSV + Highlights)
# =======================
echo "📊 Step 1: Updating fighter data and highlights..."
cd /home/onewop/ufc-betting-site-main
bash update-new-csv.sh

# =======================
# 2b. Short notice / debut check
# =======================
echo ""
echo "⚡ Checking for short-notice / UFC debut fighters..."
source .venv/bin/activate 2>/dev/null || true
python3 scripts/aggregate_stats.py --short-notice-only 2>/dev/null || \
    python3 - <<'PYEOF'
import sys, os
sys.path.insert(0, 'scripts')
os.chdir('/home/onewop/ufc-betting-site-main')
from aggregate_stats import check_short_notice
check_short_notice()
PYEOF
echo ""

# =======================
# 3. Git Commit Changes
# =======================
echo "📝 Step 2: Committing changes to git..."
git add .
read -p "💬 Enter commit message (or press Enter for auto message): " msg
if [ -z "$msg" ]; then
    msg="Weekly fight card update - $(date '+%Y-%m-%d %H:%M')"
fi
git commit -m "$msg"

# =======================
# 4. Push to Backend (Railway)
# =======================
echo "☁️  Step 3: Pushing to Railway backend..."
git push

# =======================
# 5. Build & Deploy Frontend (Vercel)
# =======================
echo "🏗️  Step 4: Building frontend..."
npm run build

echo "🌐 Step 5: Deploying to Vercel..."
bash deploy.sh

echo ""
echo "✅ ✅ ✅ FULL WEEKLY UPDATE COMPLETED! ✅ ✅ ✅"
echo "   • Backend → Railway updated"
echo "   • Frontend → Vercel deployed"
echo "   • Changes committed with message: $msg"
echo ""
echo "Check the live site in a few minutes."
