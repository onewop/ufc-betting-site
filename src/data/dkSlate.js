/**
 * dkSlate.js — DraftKings player data for the current UFC slate.
 *
 * HOW TO UPDATE FOR A NEW EVENT:
 *   1. Download the new DKSalaries.csv from DraftKings (Lobby → Contest → Export Salaries).
 *   2. Replace the SLATE_DATE, EVENT_NAME, and DK_PLAYERS array below.
 *      Each entry maps directly to one row in DKSalaries.csv.
 *   3. Re-run: node scripts/calculate_combinations.py  (or the npm script)
 *      to regenerate combinations.json with the new fighter IDs.
 *
 * SOURCE: DKSalaries.csv exported from DraftKings — internal use only for
 * lineup building. Do NOT redistribute DK IDs or salary data externally.
 */

export const SLATE_DATE = "04/11/2026";
export const EVENT_NAME = "UFC Fight Night: Prochazka vs. Ulberg";

/**
 * Each fighter object:
 *   id          {number}  Internal sequential ID (1-based). Used by combinations.json.
 *   name        {string}  Exact name as it appears in DraftKings.
 *   dkId        {string}  DraftKings numeric player ID.
 *   salary      {number}  DK salary (used for $50k cap enforcement).
 *   gameInfo    {string}  Matchup string from DK (e.g. "Murphy@Evloev 03/21/2026 05:40PM ET").
 *   teamAbbrev  {string}  DK team abbreviation.
 *   avgFPPG     {number}  Average fantasy points per game (from DK export).
 *   fightId     {number}  Fight pairing ID — both fighters in a bout share the same fightId.
 *                         Ensures lineup generator picks max 1 fighter per fight.
 */
export const DK_PLAYERS = [
  // fight 1 — Luque vs Gastelum
  {
    id: 1,
    name: "Vicente Luque",
    dkId: "42547533",
    salary: 7200,
    gameInfo: "Luque@Gastelum 04/11/2026 05:30PM ET",
    fightId: 1,
    teamAbbrev: "Luque",
    avgFPPG: 80.87,
  },
  {
    id: 2,
    name: "Kelvin Gastelum",
    dkId: "42547534",
    salary: 9000,
    gameInfo: "Luque@Gastelum 04/11/2026 05:30PM ET",
    fightId: 1,
    teamAbbrev: "Gastelum",
    avgFPPG: 62.11,
  },
  // fight 2 — Godinez vs Suarez
  {
    id: 3,
    name: "Tatiana Suarez",
    dkId: "42547518",
    salary: 8500,
    gameInfo: "Godinez@Suarez 04/11/2026 07:00PM ET",
    fightId: 2,
    teamAbbrev: "Suarez",
    avgFPPG: 100.69,
  },
  {
    id: 4,
    name: "Loopy Godinez",
    dkId: "42547517",
    salary: 7700,
    gameInfo: "Godinez@Suarez 04/11/2026 07:00PM ET",
    fightId: 2,
    teamAbbrev: "Godinez",
    avgFPPG: 77.34,
  },
  // fight 3 — Ribovics vs Gamrot
  {
    id: 5,
    name: "Mateusz Gamrot",
    dkId: "42547530",
    salary: 8600,
    gameInfo: "Ribovics@Gamrot 04/11/2026 07:20PM ET",
    fightId: 3,
    teamAbbrev: "Gamrot",
    avgFPPG: 83.72,
  },
  {
    id: 6,
    name: "Esteban Ribovics",
    dkId: "42547529",
    salary: 7600,
    gameInfo: "Ribovics@Gamrot 04/11/2026 07:20PM ET",
    fightId: 3,
    teamAbbrev: "Ribovics",
    avgFPPG: 83.41,
  },
  // fight 4 — Brown vs Holland
  {
    id: 7,
    name: "Randy Brown",
    dkId: "42547516",
    salary: 8400,
    gameInfo: "Brown@Holland 04/11/2026 07:40PM ET",
    fightId: 4,
    teamAbbrev: "Brown",
    avgFPPG: 62.36,
  },
  {
    id: 8,
    name: "Kevin Holland",
    dkId: "42547515",
    salary: 7800,
    gameInfo: "Brown@Holland 04/11/2026 07:40PM ET",
    fightId: 4,
    teamAbbrev: "Holland",
    avgFPPG: 66.2,
  },
  // fight 5 — Pico vs Freire
  {
    id: 9,
    name: "Aaron Pico",
    dkId: "42547531",
    salary: 9200,
    gameInfo: "Pico@Freire 04/11/2026 08:00PM ET",
    fightId: 5,
    teamAbbrev: "Pico",
    avgFPPG: 18.83,
  },
  {
    id: 10,
    name: "Patricio Freire",
    dkId: "42547532",
    salary: 7000,
    gameInfo: "Pico@Freire 04/11/2026 08:00PM ET",
    fightId: 5,
    teamAbbrev: "Freire",
    avgFPPG: 50.0,
  },
  // fight 6 — Landwehr vs Swanson
  {
    id: 11,
    name: "Nate Landwehr",
    dkId: "42547526",
    salary: 8300,
    gameInfo: "Landwehr@Swanson 04/11/2026 09:00PM ET",
    fightId: 6,
    teamAbbrev: "Landwehr",
    avgFPPG: 57.22,
  },
  {
    id: 12,
    name: "Cub Swanson",
    dkId: "42547525",
    salary: 7900,
    gameInfo: "Landwehr@Swanson 04/11/2026 09:00PM ET",
    fightId: 6,
    teamAbbrev: "Swanson",
    avgFPPG: 63.3,
  },
  // fight 7 — Walker vs Reyes
  {
    id: 13,
    name: "Dominick Reyes",
    dkId: "42547522",
    salary: 8300,
    gameInfo: "Walker@Reyes 04/11/2026 09:20PM ET",
    fightId: 7,
    teamAbbrev: "Reyes",
    avgFPPG: 73.41,
  },
  {
    id: 14,
    name: "Johnny Walker",
    dkId: "42547521",
    salary: 7900,
    gameInfo: "Walker@Reyes 04/11/2026 09:20PM ET",
    fightId: 7,
    teamAbbrev: "Walker",
    avgFPPG: 62.69,
  },
  // fight 8 — Hokit vs Blaydes
  {
    id: 15,
    name: "Curtis Blaydes",
    dkId: "42547519",
    salary: 8400,
    gameInfo: "Hokit@Blaydes 04/11/2026 09:40PM ET",
    fightId: 8,
    teamAbbrev: "Blaydes",
    avgFPPG: 80.27,
  },
  {
    id: 16,
    name: "Josh Hokit",
    dkId: "42547520",
    salary: 7800,
    gameInfo: "Hokit@Blaydes 04/11/2026 09:40PM ET",
    fightId: 8,
    teamAbbrev: "Hokit",
    avgFPPG: 131.32,
  },
  // fight 9 — Costa vs Murzakanov
  {
    id: 17,
    name: "Azamat Murzakanov",
    dkId: "42547524",
    salary: 8900,
    gameInfo: "Costa@Murzakanov 04/11/2026 10:00PM ET",
    fightId: 9,
    teamAbbrev: "Murzakanov",
    avgFPPG: 92.51,
  },
  {
    id: 18,
    name: "Paulo Costa",
    dkId: "42547523",
    salary: 7300,
    gameInfo: "Costa@Murzakanov 04/11/2026 10:00PM ET",
    fightId: 9,
    teamAbbrev: "Costa",
    avgFPPG: 75.46,
  },
  // fight 10 — Ulberg vs Prochazka (main event)
  {
    id: 19,
    name: "Jiri Prochazka",
    dkId: "42547528",
    salary: 8200,
    gameInfo: "Ulberg@Prochazka 04/11/2026 10:20PM ET",
    fightId: 10,
    teamAbbrev: "Prochazka",
    avgFPPG: 82.25,
  },
  {
    id: 20,
    name: "Carlos Ulberg",
    dkId: "42547527",
    salary: 8000,
    gameInfo: "Ulberg@Prochazka 04/11/2026 10:20PM ET",
    fightId: 10,
    teamAbbrev: "Ulberg",
    avgFPPG: 90.47,
  },
];

/** Quick lookup: DK name → full player object */
export const DK_BY_NAME = Object.fromEntries(
  DK_PLAYERS.map((p) => [p.name.toLowerCase(), p]),
);
