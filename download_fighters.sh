#!/bin/bash

# UFC Fighter Image Downloader (Wikimedia Commons only)
# Usage: Add URLs and names below, then run ./download_fighters.sh

# Create directory if missing
mkdir -p public/images/fighters

# Array of fighters: "name" "direct_commons_url"
fighters=(
  "movsar-evloev"     "https://upload.wikimedia.org/wikipedia/commons/.../Movsar_Evloev_UFC.jpg"  # Replace with real URL
  "lerone-murphy"     ""  # No good one found; leave empty or add if you find
  "michael-page"      "https://upload.wikimedia.org/wikipedia/commons/.../Michael_Page_UFC_portrait.jpg"
  "luke-riley"        ""
  "michael-aswell"    ""
  "sam-patterson"     ""
  # Add more fighters here as you find Commons URLs
)

echo "Downloading UFC fighter images from Wikimedia Commons..."

for ((i=0; i<${#fighters[@]}; i+=2)); do
  name="${fighters[i]}"
  url="${fighters[i+1]}"

  if [ -z "$url" ]; then
    echo "Skipping $name - no URL provided"
    continue
  fi

  filename="public/images/fighters/$name.jpg"
  
  echo "Downloading $name → $filename"
  curl -L -s -o "$filename" "$url" || echo "Failed to download $name"

  # Optional: Print reminder to add credit in FighterImage.jsx
  echo "→ Add credit in FighterImage.jsx: '$name': 'Photo by [uploader], CC-BY 4.0, Wikimedia Commons'"
done

echo "Done! Check public/images/fighters/ folder."
echo "Remember: Only use CC-BY/PD images — verify license on each Commons file page."