# Eon UFC Betting Site

A React-based UFC betting website with a landing page, tattoo shop, DFS team combinations, and fight analyzer for UFC 319.

## Setup

1. Clone or copy the folder structure into `C:\Users\<YourUsername>\Desktop\ufc-betting-site`.
2. Install Node.js: Download from nodejs.org (LTS version).
3. Install dependencies: `npm install`.
4. Install Python: Download from python.org (3.10+).
5. Run Python scripts to generate fighter data:
   - `python scripts\calculate_combinations.py` (for DFS teams).
   - `python scripts\aggregate_stats.py` (for fight analyzer).
6. Start Tailwind CSS: `npm run tailwind` (in one terminal).
7. Start React server: `npm start` (in another terminal).
8. Open `http://localhost:3000` in your browser.

## Pages

- **Home**: Landing page with links to tattoos, DFS teams, and fight analyzer.
- **ShopTattoos**: Buy _Eon: Time’s a Mess_ tramp stamps (e.g., Chrona Sparkle).
- **TeamCombinations**: Calculate DraftKings team combinations and generate 5 random teams.
- **FightAnalyzer**: Ask AI questions about UFC 319 fights, answered with detailed stats.

## Notes

- Replace `public\fighters.json` with UFC 319 data (names, salaries, fight_id, stats).
- Images (`chrona_sparkle.png`, etc.) are placeholders; generate using ComfyUI or RunComfy.
- Deploy to Vercel: `vercel --prod`.
