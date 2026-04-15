#!/bin/bash
# =============================================================================
# update-new-csv.sh
# Use when DraftKings has posted a new slate (fights added or cancelled).
# 1) Finds the new DKSalaries CSV in ~/Downloads and installs it
# 2) Runs the full data pipeline with ALL scrapers
# 3) Syncs outputs to build/
# =============================================================================

set -e
cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"
VENV="$PROJECT_ROOT/.venv/bin/activate"

echo ""
echo "=============================================="
echo "  UFC DATA UPDATE — NEW CARD (CSV IMPORT)"
echo "=============================================="
echo ""

# ── Step 1: Find the new DKSalaries CSV in ~/Downloads ────────────────────────
DOWNLOADS="$HOME/Downloads"
echo "Searching $DOWNLOADS for DKSalaries*.csv ..."
echo ""

# Collect all matching files sorted by modification time (newest first)
mapfile -t FOUND < <(find "$DOWNLOADS" -maxdepth 1 -iname "DKSalaries*.csv" -printf "%T@ %p\n" 2>/dev/null \
    | sort -rn | awk '{print $2}')

if [[ ${#FOUND[@]} -eq 0 ]]; then
    echo "  No DKSalaries*.csv found in ~/Downloads."
    echo ""
    echo "  Download the CSV from DraftKings, then:"
    echo "    - Leave it in ~/Downloads (any name containing DKSalaries)"
    echo "    - OR enter the full path below"
    echo ""
    read -rp "  Full path to CSV file: " MANUAL_PATH
    MANUAL_PATH="${MANUAL_PATH/#\~/$HOME}"   # expand ~ if user typed it
    if [[ ! -f "$MANUAL_PATH" ]]; then
        echo ""
        echo "  ERROR: File not found: $MANUAL_PATH"
        echo ""
        read -rp "  Press Enter to close..."
        exit 1
    fi
    SELECTED="$MANUAL_PATH"

elif [[ ${#FOUND[@]} -eq 1 ]]; then
    SELECTED="${FOUND[0]}"
    echo "  Found: $(basename "$SELECTED")"
    echo "  Full path: $SELECTED"
    echo ""
    read -rp "  Use this file? [Y/n]: " CONFIRM
    if [[ "$CONFIRM" =~ ^[Nn] ]]; then
        echo ""
        echo "  Enter the full path to the correct CSV file:"
        read -rp "  Path: " MANUAL_PATH
        MANUAL_PATH="${MANUAL_PATH/#\~/$HOME}"
        if [[ ! -f "$MANUAL_PATH" ]]; then
            echo ""
            echo "  ERROR: File not found: $MANUAL_PATH"
            read -rp "  Press Enter to close..."
            exit 1
        fi
        SELECTED="$MANUAL_PATH"
    fi

else
    echo "  Multiple DKSalaries files found (newest first):"
    echo ""
    for i in "${!FOUND[@]}"; do
        MTIME=$(stat -c "%y" "${FOUND[$i]}" | cut -d'.' -f1)
        echo "  [$i] $(basename "${FOUND[$i]}")  ($MTIME)"
    done
    echo ""
    read -rp "  Select number [0 = newest]: " IDX
    IDX="${IDX:-0}"
    if [[ -z "${FOUND[$IDX]+x}" ]]; then
        echo "  ERROR: Invalid selection."
        read -rp "  Press Enter to close..."
        exit 1
    fi
    SELECTED="${FOUND[$IDX]}"
fi

echo ""
echo "  → Source:  $SELECTED"
echo "  → Installing as: $PROJECT_ROOT/DKSalaries.csv"
echo ""

# Back up the old CSV just in case
if [[ -f "$PROJECT_ROOT/DKSalaries.csv" ]]; then
    BACKUP="$PROJECT_ROOT/DKSalaries.csv.bak"
    cp "$PROJECT_ROOT/DKSalaries.csv" "$BACKUP"
    echo "  ✓ Old CSV backed up to DKSalaries.csv.bak"
fi

cp "$SELECTED" "$PROJECT_ROOT/DKSalaries.csv"
echo "  ✓ DKSalaries.csv installed"

# Show a quick summary of what's in the new file
FIGHTER_COUNT=$(tail -n +2 "$PROJECT_ROOT/DKSalaries.csv" | wc -l)
echo "  ✓ $FIGHTER_COUNT fighter rows detected in new CSV"

# ── Step 2: Optional Sherdog event URL ────────────────────────────────────────
echo ""
echo "  (Optional) Providing the Sherdog event URL speeds up fighter"
echo "  nationality/team/record scraping by ~50%."
echo "  Find it at: https://www.sherdog.com/organizations/Ultimate-Fighting-Championship-2"
echo "  Example:    https://www.sherdog.com/events/UFC-314-Volkanovski-vs-Lopes-2-123456"
echo ""
read -rp "  Sherdog event URL [Enter to skip]: " SHERDOG_URL
echo ""

# ── Step 3: Run the full data pipeline ────────────────────────────────────────
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

# ── Step 4: Regenerate upcoming.csv matchup template ──────────────────────────
echo ""
echo "── Regenerating upcoming.csv matchup template (preserving existing odds)..."
python3 scripts/generate_upcoming_template.py --merge
echo "   ✓ upcoming.csv updated"

# ── Step 5: Sync public/ → build/ + backend/ ─────────────────────────────────
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
echo "  ✅ DONE!  New card is ready."
echo "  Refresh the site (npm start / hard-reload)"
echo "  to see the updated fighters."
echo "=============================================="
echo ""
read -rp "  Press Enter to close this window..."
