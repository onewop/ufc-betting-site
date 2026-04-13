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

export const SLATE_DATE = "03/21/2026";
export const EVENT_NAME = "UFC Fight Night: Evloev vs. Murphy";

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
  // fight 1 — Franco vs Pinto
  {
    id: 1,
    name: "Mario Pinto",
    dkId: "42305467",
    salary: 9700,
    gameInfo: "Franco@Pinto 03/21/2026 02:40PM ET",
    fightId: 1,
    teamAbbrev: "Pinto",
    avgFPPG: 106.49,
  },
  {
    id: 2,
    name: "Felipe Franco",
    dkId: "42305468",
    salary: 6500,
    gameInfo: "Franco@Pinto 03/21/2026 02:40PM ET",
    fightId: 1,
    teamAbbrev: "Franco",
    avgFPPG: 0,
  },
  // fight 2 — Trocoli vs Kondratavicius
  {
    id: 3,
    name: "Mantas Kondratavicius",
    dkId: "42305462",
    salary: 9600,
    gameInfo: "Trocoli@Kondratavicius 03/21/2026 02:20PM ET",
    fightId: 2,
    teamAbbrev: "Kondratavicius",
    avgFPPG: 0,
  },
  {
    id: 4,
    name: "Antonio Trocoli",
    dkId: "42305461",
    salary: 6600,
    gameInfo: "Trocoli@Kondratavicius 03/21/2026 02:20PM ET",
    fightId: 2,
    teamAbbrev: "Trocoli",
    avgFPPG: 7.28,
  },
  // fight 3 — Lane vs Baraniewski
  {
    id: 5,
    name: "Iwo Baraniewski",
    dkId: "42305448",
    salary: 9500,
    gameInfo: "Lane@Baraniewski 03/21/2026 04:40PM ET",
    fightId: 3,
    teamAbbrev: "Baraniewski",
    avgFPPG: 120.33,
  },
  {
    id: 6,
    name: "Austen Lane",
    dkId: "42305447",
    salary: 6700,
    gameInfo: "Lane@Baraniewski 03/21/2026 04:40PM ET",
    fightId: 3,
    teamAbbrev: "Lane",
    avgFPPG: 22.8,
  },
  // fight 4 — Oliveira vs Dyer
  {
    id: 7,
    name: "Shanelle Dyer",
    dkId: "42305463",
    salary: 9400,
    gameInfo: "Oliveira@Dyer 03/21/2026 01:20PM ET",
    fightId: 4,
    teamAbbrev: "Dyer",
    avgFPPG: 0,
  },
  {
    id: 8,
    name: "Ravena Oliveira",
    dkId: "42305464",
    salary: 6800,
    gameInfo: "Oliveira@Dyer 03/21/2026 01:20PM ET",
    fightId: 4,
    teamAbbrev: "Oliveira",
    avgFPPG: 23.43,
  },
  // fight 5 — Duncan vs Dolidze
  {
    id: 9,
    name: "Christian Leroy Duncan",
    dkId: "42305445",
    salary: 9300,
    gameInfo: "Duncan@Dolidze 03/21/2026 04:20PM ET",
    fightId: 5,
    teamAbbrev: "Duncan",
    avgFPPG: 82.44,
  },
  {
    id: 10,
    name: "Roman Dolidze",
    dkId: "42305446",
    salary: 6900,
    gameInfo: "Duncan@Dolidze 03/21/2026 04:20PM ET",
    fightId: 5,
    teamAbbrev: "Dolidze",
    avgFPPG: 77.17,
  },
  // fight 6 — Aswell Jr. vs Riley
  {
    id: 11,
    name: "Luke Riley",
    dkId: "42305456",
    salary: 9100,
    gameInfo: "Aswell Jr.@Riley 03/21/2026 05:20PM ET",
    fightId: 6,
    teamAbbrev: "Riley",
    avgFPPG: 87.25,
  },
  {
    id: 12,
    name: "Michael Aswell Jr.",
    dkId: "42305455",
    salary: 7100,
    gameInfo: "Aswell Jr.@Riley 03/21/2026 05:20PM ET",
    fightId: 6,
    teamAbbrev: "Aswell Jr.",
    avgFPPG: 85.22,
  },
  // fight 7 — Pericic vs Sutherland
  {
    id: 13,
    name: "Brando Pericic",
    dkId: "42305457",
    salary: 9000,
    gameInfo: "Pericic@Sutherland 03/21/2026 02:00PM ET",
    fightId: 7,
    teamAbbrev: "Pericic",
    avgFPPG: 102.67,
  },
  {
    id: 14,
    name: "Louie Sutherland",
    dkId: "42305458",
    salary: 7200,
    gameInfo: "Pericic@Sutherland 03/21/2026 02:00PM ET",
    fightId: 7,
    teamAbbrev: "Sutherland",
    avgFPPG: 1.2,
  },
  // fight 8 — Murphy vs Evloev (main event)
  {
    id: 15,
    name: "Movsar Evloev",
    dkId: "42305441",
    salary: 8900,
    gameInfo: "Murphy@Evloev 03/21/2026 05:40PM ET",
    fightId: 8,
    teamAbbrev: "Evloev",
    avgFPPG: 102.27,
  },
  {
    id: 16,
    name: "Lerone Murphy",
    dkId: "42305442",
    salary: 7300,
    gameInfo: "Murphy@Evloev 03/21/2026 05:40PM ET",
    fightId: 8,
    teamAbbrev: "Murphy",
    avgFPPG: 87.25,
  },
  // fight 9 — Silva vs Campbell
  {
    id: 17,
    name: "Kurtis Campbell",
    dkId: "42305450",
    salary: 8800,
    gameInfo: "Silva@Campbell 03/21/2026 04:00PM ET",
    fightId: 9,
    teamAbbrev: "Campbell",
    avgFPPG: 0,
  },
  {
    id: 18,
    name: "Danny Silva",
    dkId: "42305449",
    salary: 7400,
    gameInfo: "Silva@Campbell 03/21/2026 04:00PM ET",
    fightId: 9,
    teamAbbrev: "Silva",
    avgFPPG: 61.32,
  },
  // fight 10 — Keita vs Wood
  {
    id: 19,
    name: "Losene Keita",
    dkId: "42305444",
    salary: 8700,
    gameInfo: "Keita@Wood 03/21/2026 03:00PM ET",
    fightId: 10,
    teamAbbrev: "Keita",
    avgFPPG: 0,
  },
  {
    id: 20,
    name: "Nathaniel Wood",
    dkId: "42305443",
    salary: 7500,
    gameInfo: "Keita@Wood 03/21/2026 03:00PM ET",
    fightId: 10,
    teamAbbrev: "Wood",
    avgFPPG: 80.3,
  },
  // fight 11 — Patterson vs Page
  {
    id: 21,
    name: "Michael Page",
    dkId: "42305465",
    salary: 8600,
    gameInfo: "Patterson@Page 03/21/2026 05:00PM ET",
    fightId: 11,
    teamAbbrev: "Page",
    avgFPPG: 40.77,
  },
  {
    id: 22,
    name: "Sam Patterson",
    dkId: "42305466",
    salary: 7600,
    gameInfo: "Patterson@Page 03/21/2026 05:00PM ET",
    fightId: 11,
    teamAbbrev: "Patterson",
    avgFPPG: 81.48,
  },
  // fight 12 — Sola vs Jones
  {
    id: 23,
    name: "Mason Jones",
    dkId: "42305451",
    salary: 8400,
    gameInfo: "Sola@Jones 03/21/2026 03:20PM ET",
    fightId: 12,
    teamAbbrev: "Jones",
    avgFPPG: 81.34,
  },
  {
    id: 24,
    name: "Axel Sola",
    dkId: "42305452",
    salary: 7800,
    gameInfo: "Sola@Jones 03/21/2026 03:20PM ET",
    fightId: 12,
    teamAbbrev: "Sola",
    avgFPPG: 84.95,
  },
  // fight 13 — Al-Selwady vs Rock
  {
    id: 25,
    name: "Abdul-Kareem Al-Selwady",
    dkId: "42305454",
    salary: 8300,
    gameInfo: "Al-Selwady@Rock 03/21/2026 01:40PM ET",
    fightId: 13,
    teamAbbrev: "Al-Selwady",
    avgFPPG: 37.52,
  },
  {
    id: 26,
    name: "Shem Rock",
    dkId: "42305453",
    salary: 7900,
    gameInfo: "Al-Selwady@Rock 03/21/2026 01:40PM ET",
    fightId: 13,
    teamAbbrev: "Rock",
    avgFPPG: 30.16,
  },
  // fight 14 — Carolina vs Mullins
  {
    id: 27,
    name: "Luana Carolina",
    dkId: "42305460",
    salary: 8200,
    gameInfo: "Carolina@Mullins 03/21/2026 01:00PM ET",
    fightId: 14,
    teamAbbrev: "Carolina",
    avgFPPG: 58.09,
  },
  {
    id: 28,
    name: "Melissa Mullins",
    dkId: "42305459",
    salary: 8000,
    gameInfo: "Carolina@Mullins 03/21/2026 01:00PM ET",
    fightId: 14,
    teamAbbrev: "Mullins",
    avgFPPG: 60.97,
  },
];

/** Quick lookup: DK name → full player object */
export const DK_BY_NAME = Object.fromEntries(
  DK_PLAYERS.map((p) => [p.name.toLowerCase(), p]),
);
