#!/bin/bash
# =============================================================================
# update-stats-only.sh
# Use to refresh all fighter stats WITHOUT changing the DKSalaries.csv.
# Run this when odds/stats need updating but the fight card hasn't changed.
# Runs the full data pipeline with ALL scrapers enabled.
# =============================================================================

set -e
cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"
VENV="$PROJECT_ROOT/.venv/bin/activate"

echo ""
echo "=============================================="
echo "  UFC DATA UPDATE — STATS REFRESH"
echo "  (Existing DKSalaries.csv unchanged)"
echo "=============================================="
echo ""

# ── Confirm DKSalaries.csv exists ─────────────────────────────────────────────
if [[ ! -f "$PROJECT_ROOT/DKSalaries.csv" ]]; then
    echo "  ERROR: DKSalaries.csv not found in project root."
    echo "  Use update-new-csv.sh to import a CSV from DraftKings first."
    echo ""
    read -rp "  Press Enter to close..."
    exit 1
fi

FIGHTER_COUNT=$(tail -n +2 "$PROJECT_ROOT/DKSalaries.csv" | wc -l)
FIRST_FIGHT=$(awk -F',' 'NR==2{print $7}' "$PROJECT_ROOT/DKSalaries.csv" | sed 's/ [0-9].*//')
echo "  Current CSV:  DKSalaries.csv"
echo "  Fighters:     $FIGHTER_COUNT rows"
echo "  First matchup: $FIRST_FIGHT"
echo ""

# ── Optional Sherdog event URL ─────────────────────────────────────────────────
echo "  (Optional) Providing the Sherdog event URL speeds up fighter"
echo "  nationality/team/record scraping by ~50%."
echo "  Find it at: https://www.sherdog.com/organizations/Ultimate-Fighting-Championship-2"
echo "  Example:    https://www.sherdog.com/events/UFC-314-Volkanovski-vs-Lopes-2-123456"
echo ""
read -rp "  Sherdog event URL [Enter to skip]: " SHERDOG_URL
echo ""

# ── Run the full data pipeline ─────────────────────────────────────────────────
echo "=============================================="
echo "  RUNNING FULL PIPELINE (all scrapers enabled)"
echo ""
echo "  SCRAPE_UFCSTATS=1      (+td/str defense stats)"
echo "  SCRAPE_PERFIGHT=1      (+KD/CTRL time per fight)"
echo "  SCRAPE_DEF_GRAPPLING=1 (+submission defense)"
echo "  SCRAPE_SHERDOG=1       (+nationality/team/record)"
echo ""
echo "  First run:  ~15-45 min"
echo "  After that: ~5-10 min (uses cache)"
echo "=============================================="
echo ""

source "$VENV"
cd "$PROJECT_ROOT"

export SCRAPE_UFCSTATS=1
export SCRAPE_PERFIGHT=1
export SCRAPE_DEF_GRAPPLING=1
export SCRAPE_SHERDOG=1
[[ -n "$SHERDOG_URL" ]] && export SHERDOG_EVENT_URL="$SHERDOG_URL"

python3 scripts/aggregate_stats.py

# ── Sync public/ → build/ + backend/ ────────────────────────────────────────
echo ""
echo "── Syncing outputs to build/ and backend/ ..."
for f in this_weeks_stats.json current_event.json DKSalaries.csv upcoming.csv; do
    if [[ -f "public/$f" ]]; then
        cp "public/$f" "build/$f"
        echo "   ✓ build/$f"
    fi
done

# Always sync this_weeks_stats.json to backend/ so Railway can find it
if [[ -f "public/this_weeks_stats.json" ]]; then
    cp "public/this_weeks_stats.json" "backend/this_weeks_stats.json"
    echo "   ✓ backend/this_weeks_stats.json"
fi

echo ""
echo "=============================================="
echo "  ✅ DONE!  Stats refreshed."
echo "  Refresh the site (npm start / hard-reload)"
echo "  to see updated stats."
echo "=============================================="
echo ""
read -rp "  Press Enter to close this window..."
