/**
 * FighterDirectory.jsx — Combat Dossier: All Fighters
 *
 * Route: /fighters
 *
 * Searchable, filterable grid of UFC fighter profiles.
 * Data (3-tier fallback):
 *   1. GET /api/fighters (built profiles index)
 *   2. /fighters_index.json (static build output)
 *   3. /fighters_active.json (CSV seed — always available)
 */
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Derive Sherdog CDN portrait from a Sherdog profile URL. */
function sherdogPortrait(url) {
  if (!url) return null;
  const m = url.match(/\/fighter\/[^/]+(\d+)\/?$/);
  return m ? `https://www.sherdog.com/image_crop/300/400/_images/fighter/${m[1]}_ff.jpg` : null;
}

// ── Weight class canonical order ─────────────────────────────────────────────
const WEIGHT_CLASSES = [
  "All",
  "Heavyweight",
  "Light Heavyweight",
  "Middleweight",
  "Welterweight",
  "Lightweight",
  "Featherweight",
  "Bantamweight",
  "Flyweight",
  "Women's Featherweight",
  "Women's Bantamweight",
  "Women's Flyweight",
  "Women's Strawweight",
];

const WC_SHORT = {
  Heavyweight: "HW",
  "Light Heavyweight": "LHW",
  Middleweight: "MW",
  Welterweight: "WW",
  Lightweight: "LW",
  Featherweight: "FW",
  Bantamweight: "BW",
  Flyweight: "FLY",
  "Women's Featherweight": "W-FW",
  "Women's Bantamweight": "W-BW",
  "Women's Flyweight": "W-FLY",
  "Women's Strawweight": "W-SW",
};

// ── Normalise seed vs profile field names ─────────────────────────────────────
function normFighter(f) {
  return {
    ...f,
    // fighters_active.json uses "win_streak"; fighters_index.json uses "current_win_streak"
    current_win_streak: f.current_win_streak ?? f.win_streak ?? 0,
    finish_rate_pct: f.finish_rate_pct ?? 0,
    wins_ko_tko: f.wins_ko_tko ?? 0,
    wins_submission: f.wins_submission ?? 0,
    wins: f.wins ?? 0,
    losses: f.losses ?? 0,
  };
}

// ── Fighter Card ─────────────────────────────────────────────────────────────

function FighterCard({ fighter }) {
  const {
    slug,
    name,
    nickname,
    record,
    weight_class,
    nationality,
    ufc_image_url,
    sherdog_url,
    finish_rate_pct,
    current_win_streak,
    wins_ko_tko,
    wins_submission,
    wins,
    losses,
    rank_in_class,
    pfp_rank,
    title_bouts,
    gender,
  } = fighter;

  const [imgFailed, setImgFailed] = useState(false);
  const portraitUrl = (!imgFailed && (ufc_image_url || sherdogPortrait(sherdog_url))) || null;

  const isWomen =
    gender === "FEMALE" || (weight_class || "").startsWith("Women");
  const isChamp = rank_in_class === 0;
  const isRanked =
    rank_in_class != null && rank_in_class > 0 && rank_in_class <= 15;
  const hasTitles = title_bouts >= 1;

  const streakBadge =
    current_win_streak >= 3
      ? {
          label: `${current_win_streak}W`,
          cls: "bg-emerald-900/80 text-emerald-300 border-emerald-700/50",
        }
      : null;

  const finPct = finish_rate_pct || 0;
  const finishBadge =
    finPct >= 80
      ? {
          label: `${finPct}%`,
          cls: "bg-red-900/80 text-red-300 border-red-700/50",
        }
      : finPct >= 65
        ? {
            label: `${finPct}%`,
            cls: "bg-orange-900/80 text-orange-300 border-orange-700/50",
          }
        : null;

  // Initials for fallback avatar
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const wcShort =
    WC_SHORT[weight_class] ||
    (weight_class || "").replace("Women's ", "W-").split(" ")[0];

  return (
    <Link
      to={`/fighters/${slug}`}
      className="group relative bg-stone-900 border border-stone-700/50 hover:border-yellow-600/70 hover:shadow-[0_0_22px_rgba(202,138,4,0.18)] rounded-lg overflow-hidden transition-all duration-200 flex flex-col"
    >
      {/* ── Image zone ── */}
      <div className="relative bg-stone-800/80 aspect-[3/4] flex items-center justify-center overflow-hidden">
        {portraitUrl ? (
          <img
            src={portraitUrl}
            alt={name}
            className="w-full h-full object-cover object-top group-hover:scale-[1.04] transition-transform duration-300"
            onError={() => setImgFailed(true)}
          />
        ) : (
          /* Fallback: classified silhouette */
          <div className="flex flex-col items-center justify-center w-full h-full bg-stone-800 select-none">
            <div className="w-14 h-14 rounded-full bg-stone-700/60 border border-stone-600/40 flex items-center justify-center mb-1">
              <span className="text-lg font-black text-stone-500 font-mono">
                {initials}
              </span>
            </div>
            <span className="text-[8px] font-mono text-stone-600 tracking-widest">
              NO PHOTO
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/20 to-transparent pointer-events-none" />

        {/* Top-left: rank / champ badge */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5">
          {isChamp && (
            <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-yellow-500/90 text-stone-950 border border-yellow-400 tracking-wider">
              CHAMP
            </span>
          )}
          {!isChamp && isRanked && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-900/90 text-yellow-400 border border-yellow-700/50 tracking-wider">
              #{rank_in_class}
            </span>
          )}
          {hasTitles && !isChamp && !isRanked && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-stone-900/90 text-stone-400 border border-stone-700/40">
              EX-CHAMP
            </span>
          )}
        </div>

        {/* Top-right: streak + finish badges */}
        <div className="absolute top-1.5 right-1.5 flex flex-col gap-0.5 items-end">
          {streakBadge && (
            <span
              className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${streakBadge.cls}`}
            >
              {streakBadge.label} STK
            </span>
          )}
          {finishBadge && (
            <span
              className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${finishBadge.cls}`}
            >
              {finishBadge.label} FIN
            </span>
          )}
        </div>

        {/* Bottom: name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-[10px] font-black text-white tracking-tight leading-tight group-hover:text-yellow-300 transition-colors drop-shadow-md line-clamp-2">
            {name}
          </p>
          {nickname && (
            <p className="text-[9px] text-yellow-500/80 font-mono italic truncate leading-tight mt-0.5 drop-shadow">
              "{nickname}"
            </p>
          )}
        </div>
      </div>

      {/* ── Info zone ── */}
      <div className="px-2.5 py-2 flex flex-col gap-1.5 flex-1">
        {/* Record row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-white font-bold tracking-tight">
            {record || `${wins}-${losses}-0`}
          </span>
          {wcShort && (
            <span
              className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                isWomen
                  ? "bg-pink-950/60 text-pink-400 border-pink-800/40"
                  : "bg-stone-800/80 text-stone-400 border-stone-700/40"
              }`}
            >
              {wcShort}
            </span>
          )}
        </div>

        {/* KO/Sub line */}
        {(wins_ko_tko > 0 || wins_submission > 0) && (
          <div className="flex gap-2">
            {wins_ko_tko > 0 && (
              <span className="text-[9px] text-red-400/90 font-mono">
                {wins_ko_tko} KO
              </span>
            )}
            {wins_submission > 0 && (
              <span className="text-[9px] text-blue-400/90 font-mono">
                {wins_submission} SUB
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── CTA footer ── */}
      <div className="px-2.5 py-1.5 border-t border-stone-800/80 flex items-center justify-between">
        <span className="text-[9px] font-mono text-stone-600 tracking-widest">
          DOSSIER
        </span>
        <span className="text-[9px] font-mono text-yellow-700 group-hover:text-yellow-500 transition-colors tracking-wider">
          VIEW →
        </span>
      </div>
    </Link>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, pageSize, onPage }) {
  if (totalPages <= 1) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  // Show at most 7 page buttons around the current page
  const range = [];
  const delta = 2;
  for (let i = 0; i < totalPages; i++) {
    if (
      i === 0 ||
      i === totalPages - 1 ||
      (i >= page - delta && i <= page + delta)
    ) {
      range.push(i);
    }
  }
  // Insert ellipsis gaps
  const pages = [];
  let prev = -1;
  for (const p of range) {
    if (prev !== -1 && p - prev > 1) pages.push("…");
    pages.push(p);
    prev = p;
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <p className="text-[11px] font-mono text-stone-500">
        SHOWING {from}–{to} OF {total.toLocaleString()} FIGHTERS
      </p>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="px-2.5 py-1.5 text-[10px] font-mono bg-stone-800 text-stone-400 border border-stone-700/60 rounded hover:border-yellow-700/50 hover:text-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ← PREV
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ell-${i}`}
              className="px-1 text-stone-600 font-mono text-xs"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`w-8 h-8 text-[10px] font-mono rounded border transition-all ${
                p === page
                  ? "bg-yellow-700/40 text-yellow-400 border-yellow-600/60 font-bold"
                  : "bg-stone-800 text-stone-500 border-stone-700/50 hover:border-stone-500 hover:text-stone-300"
              }`}
            >
              {p + 1}
            </button>
          ),
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages - 1}
          className="px-2.5 py-1.5 text-[10px] font-mono bg-stone-800 text-stone-400 border border-stone-700/60 rounded hover:border-yellow-700/50 hover:text-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          NEXT →
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function FighterDirectory() {
  const [fighters, setFighters] = useState([]);
  const [dataSource, setDataSource] = useState(null); // "api" | "index" | "seed"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [weightFilter, setWeightFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All"); // "All" | "MALE" | "FEMALE"
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 60;

  // ── 3-tier data load ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);

    const normalize = (arr) => (Array.isArray(arr) ? arr.map(normFighter) : []);

    // Tier 1: backend API
    api
      .get("/api/fighters?limit=1000")
      .then((data) => {
        const list = normalize(data.results || data);
        if (list.length > 0) {
          setFighters(list);
          setDataSource("api");
          setLoading(false);
          return;
        }
        throw new Error("empty");
      })
      .catch(() => {
        // Tier 2: static fighters_index.json (built profiles)
        fetch("/fighters_index.json")
          .then((r) => r.json())
          .then((d) => {
            const list = normalize(d);
            if (list.length > 0) {
              setFighters(list);
              setDataSource("index");
              setLoading(false);
              return;
            }
            throw new Error("empty");
          })
          .catch(() => {
            // Tier 3: fighters_active.json (CSV seed — always available)
            fetch("/fighters_active.json")
              .then((r) => r.json())
              .then((d) => {
                const list = normalize(d);
                setFighters(list);
                setDataSource("seed");
                setLoading(false);
              })
              .catch(() => {
                setError(
                  "Fighter database not found. Run generate_fighter_seed.py first.",
                );
                setLoading(false);
              });
          });
      });
  }, []);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [search, weightFilter, genderFilter, sortBy]);

  const filtered = useMemo(() => {
    let list = [...fighters];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          (f.name || "").toLowerCase().includes(q) ||
          (f.nickname || "").toLowerCase().includes(q) ||
          (f.nationality || "").toLowerCase().includes(q) ||
          (f.team || "").toLowerCase().includes(q),
      );
    }

    if (genderFilter !== "All") {
      list = list.filter((f) => {
        const isWomen = (f.weight_class || "").startsWith("Women");
        return genderFilter === "FEMALE" ? isWomen : !isWomen;
      });
    }

    if (weightFilter !== "All") {
      list = list.filter((f) =>
        (f.weight_class || "")
          .toLowerCase()
          .includes(weightFilter.toLowerCase()),
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "record") return (b.wins || 0) - (a.wins || 0);
      if (sortBy === "finish")
        return (b.finish_rate_pct || 0) - (a.finish_rate_pct || 0);
      if (sortBy === "streak")
        return (b.current_win_streak || 0) - (a.current_win_streak || 0);
      if (sortBy === "rank") {
        const ar = a.rank_in_class ?? 999;
        const br = b.rank_in_class ?? 999;
        return ar - br;
      }
      return 0;
    });

    return list;
  }, [fighters, search, weightFilter, genderFilter, sortBy]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Weight class chips — only show classes present in data
  const availableWCs = useMemo(() => {
    const wcs = new Set(
      fighters.map((f) => f.weight_class || "").filter(Boolean),
    );
    return WEIGHT_CLASSES.filter((wc) => wc === "All" || wcs.has(wc));
  }, [fighters]);

  // Per-class counts for chips
  const wcCounts = useMemo(() => {
    const counts = {};
    for (const f of fighters) {
      const wc = f.weight_class || "";
      counts[wc] = (counts[wc] || 0) + 1;
    }
    return counts;
  }, [fighters]);

  const sourceLabel =
    dataSource === "api"
      ? "LIVE"
      : dataSource === "index"
        ? "CACHED"
        : dataSource === "seed"
          ? "SEED"
          : "";

  return (
    <div className="min-h-screen bg-stone-950 pb-16">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8">
        {/* ── Header ── */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="h-px w-8 sm:w-14 bg-yellow-800/60" />
            <span className="text-[9px] sm:text-[10px] font-mono text-yellow-700 tracking-[0.35em] uppercase">
              ◆ OPERATION COMBAT VAULT ◆
            </span>
            <div className="h-px w-8 sm:w-14 bg-yellow-800/60" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase">
            Combat Dossiers
          </h1>

          <div className="flex items-center justify-center gap-3 mt-3">
            {loading ? (
              <span className="text-stone-500 font-mono text-xs animate-pulse tracking-widest">
                ▶ SCANNING INTEL DATABASE...
              </span>
            ) : (
              <>
                <span className="text-stone-400 font-mono text-xs">
                  <span className="text-yellow-500 font-bold">
                    {fighters.length.toLocaleString()}
                  </span>{" "}
                  fighter profiles
                </span>
                {sourceLabel && (
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded border tracking-wider ${
                      sourceLabel === "LIVE"
                        ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/50"
                        : "bg-stone-800/80 text-stone-500 border-stone-700/40"
                    }`}
                  >
                    {sourceLabel}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── INTEL FILTER panel ── */}
        <div className="bg-stone-900/80 border border-stone-700/50 rounded-xl p-4 mb-6 space-y-3">
          {/* Panel header */}
          <div className="flex items-center gap-2 pb-1 border-b border-stone-800">
            <span className="text-[9px] font-mono text-yellow-700 tracking-[0.3em]">
              INTEL FILTER
            </span>
            <div className="flex-1 h-px bg-stone-800" />
            {(search || weightFilter !== "All" || genderFilter !== "All") && (
              <button
                onClick={() => {
                  setSearch("");
                  setWeightFilter("All");
                  setGenderFilter("All");
                }}
                className="text-[9px] font-mono text-stone-600 hover:text-stone-400 tracking-wider transition-colors"
              >
                CLEAR ALL ✕
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600 text-[11px] font-mono">
              ▶
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, nickname, nationality, team..."
              className="w-full bg-stone-800/60 border border-stone-700/50 rounded-lg pl-8 pr-8 py-2.5 text-sm text-stone-200 placeholder-stone-600 focus:border-yellow-600/50 focus:ring-1 focus:ring-yellow-600/10 focus:outline-none font-mono transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-300 text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Gender toggle */}
          <div className="flex gap-1.5 items-center">
            <span className="text-[9px] font-mono text-stone-600 tracking-widest mr-1">
              DIVISION:
            </span>
            {[
              ["All", "ALL"],
              ["MALE", "MEN"],
              ["FEMALE", "WOMEN"],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setGenderFilter(val)}
                className={`text-[9px] font-mono px-2.5 py-1 rounded border transition-all ${
                  genderFilter === val
                    ? val === "FEMALE"
                      ? "bg-pink-900/40 text-pink-300 border-pink-700/50"
                      : "bg-yellow-700/30 text-yellow-400 border-yellow-600/50"
                    : "bg-stone-800/60 text-stone-600 border-stone-700/40 hover:border-stone-600 hover:text-stone-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Weight class chips */}
          <div className="flex flex-wrap gap-1">
            {availableWCs.map((wc) => {
              const count = wc === "All" ? fighters.length : wcCounts[wc] || 0;
              const isWomenClass = wc.startsWith("Women");
              return (
                <button
                  key={wc}
                  onClick={() => setWeightFilter(wc)}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all ${
                    weightFilter === wc
                      ? isWomenClass
                        ? "bg-pink-900/40 text-pink-300 border-pink-700/50"
                        : "bg-yellow-700/30 text-yellow-400 border-yellow-600/50"
                      : "bg-stone-800/50 text-stone-600 border-stone-700/30 hover:border-stone-600 hover:text-stone-400"
                  }`}
                >
                  {wc === "All" ? "ALL" : wc.replace("Women's ", "W-")}{" "}
                  <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Sort + result count */}
          <div className="flex items-center justify-between pt-1 border-t border-stone-800/60">
            <span className="text-[10px] font-mono text-stone-500">
              {filtered.length.toLocaleString()}
              {search || weightFilter !== "All" || genderFilter !== "All"
                ? " MATCHED"
                : " FIGHTERS"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-stone-600 font-mono tracking-widest">
                SORT:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-stone-800/80 border border-stone-700/50 text-stone-300 text-[10px] font-mono rounded px-2 py-1 focus:outline-none focus:border-yellow-600/40 cursor-pointer"
              >
                <option value="name">NAME A–Z</option>
                <option value="record">MOST WINS</option>
                <option value="finish">FINISH RATE</option>
                <option value="streak">WIN STREAK</option>
                <option value="rank">RANKED FIRST</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── States ── */}
        {loading && (
          <div className="text-center py-24">
            <div className="inline-flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-yellow-700/50 border-t-yellow-500 animate-spin" />
              <span className="text-stone-500 font-mono text-xs tracking-[0.4em]">
                ACCESSING DATABASE...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-20 font-mono">
            <div className="inline-block bg-red-950/40 border border-red-900/50 rounded-xl px-8 py-6">
              <p className="text-red-400 text-sm mb-3">⚠ {error}</p>
              <p className="text-stone-600 text-xs">
                Run:{" "}
                <code className="text-yellow-700">
                  python3 scripts/generate_fighter_seed.py
                </code>
              </p>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-block bg-stone-900/60 border border-stone-700/40 rounded-xl px-8 py-6">
              <p className="text-stone-400 font-mono text-sm mb-2">
                NO RECORDS FOUND
              </p>
              <p className="text-stone-600 font-mono text-xs">
                "{search}" — no matching fighters
              </p>
            </div>
          </div>
        )}

        {!loading && !error && paginated.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
              {paginated.map((f) => (
                <FighterCard key={f.slug} fighter={f} />
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPage={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
