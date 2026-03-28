#!/usr/bin/env bash
# ============================================================
# download_fighter_images.sh
# Downloads free/CC-licensed fighter headshots from Wikimedia
# Commons and saves them to public/images/fighters/.
#
# Usage: bash scripts/download_fighter_images.sh
#
# HOW TO ADD A NEW FIGHTER:
#  1. Search https://commons.wikimedia.org for "[Name] UFC"
#  2. Click the image → click "Download" → copy the direct URL
#  3. Add a new curl line below with the kebab-case filename
#  4. Add the credit string to src/components/FighterImage.jsx
#     in the CREDITS map.
#
# LICENSE REQUIREMENT:
#  Only use images marked CC-BY, CC-BY-SA, or Public Domain.
#  Credit must appear as alt text / tooltip in the component.
# ============================================================

TARGET="$(dirname "$0")/../public/images/fighters"
mkdir -p "$TARGET"

download_fighter() {
  local name="$1"   # kebab-case filename without extension
  local url="$2"    # direct image URL from Wikimedia Commons
  local ext="${url##*.}"   # infer extension from URL
  ext="${ext%%\?*}"        # strip any query string
  local out="$TARGET/${name}.${ext}"

  if [[ -f "$out" ]]; then
    echo "  [skip] ${name}.${ext} already exists"
    return
  fi

  echo "  [dl]   ${name}.${ext}"
  curl -L --silent --show-error --fail \
    -H "User-Agent: ufc-betting-site/1.0 (educational; contact via GitHub)" \
    "$url" -o "$out" \
    && echo "         saved to public/images/fighters/${name}.${ext}" \
    || echo "  [err]  Failed to download ${name}"
}

echo "Downloading UFC fighter headshots (CC/PD licensed from Wikimedia Commons)..."
echo ""

# ---------------------------------------------------------------
# Evloev vs Murphy Fight Night card
# Add Wikimedia Commons direct-download URLs below once you find them.
# Template:
#   download_fighter "first-last" "https://upload.wikimedia.org/wikipedia/commons/..."
# ---------------------------------------------------------------

# Example (placeholder — replace with real Wikimedia Commons URLs):
# Movsar Evloev — search: https://commons.wikimedia.org/w/index.php?search=Movsar+Evloev
# download_fighter "movsar-evloev" "https://upload.wikimedia.org/wikipedia/commons/REAL_PATH.jpg"

# Lerone Murphy — search: https://commons.wikimedia.org/w/index.php?search=Lerone+Murphy+UFC
# download_fighter "lerone-murphy" "https://upload.wikimedia.org/wikipedia/commons/REAL_PATH.jpg"

# Dricus Du Plessis
# download_fighter "dricus-du-plessis" "https://upload.wikimedia.org/wikipedia/commons/REAL_PATH.jpg"

# Khamzat Chimaev
# download_fighter "khamzat-chimaev" "https://upload.wikimedia.org/wikipedia/commons/REAL_PATH.jpg"

echo ""
echo "Done. Missing images will fall back to placeholder.svg in the UI."
echo "Remember to add credits to the CREDITS map in src/components/FighterImage.jsx"
