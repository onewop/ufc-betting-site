import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

const PICK_COUNT = 6;
const SALARY_CAP = 50000;
const LS_KEY_PREFIX = "disaster_lb_v1_";

// ── helpers ──────────────────────────────────────────────────────────────────

function penaltyTotal(p = {}) {
  return (p.quit ? -50 : 0) + (p.firstMin ? -30 : 0) + (p.blowout ? -20 : 0);
}

function lsKey(eventName) {
  return (
    LS_KEY_PREFIX + (eventName || "default").replace(/\s+/g, "_").toLowerCase()
  );
}

function loadBoard(eventName) {
  try {
    return JSON.parse(localStorage.getItem(lsKey(eventName)) || "[]");
  } catch {
    return [];
  }
}

function saveBoard(eventName, board) {
  try {
    localStorage.setItem(lsKey(eventName), JSON.stringify(board));
  } catch {}
}

// ── component ─────────────────────────────────────────────────────────────────

export default function DisasterPicks({ eventTitle }) {
  // ── data ──
  const [fights, setFights] = useState([]);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── pick phase ──
  // myPicks: array of fighter names (max PICK_COUNT, one per fight)
  const [myPicks, setMyPicks] = useState([]);

  // ── results phase ──
  const [showResults, setShowResults] = useState(false);
  const [realScores, setRealScores] = useState({}); // { name: string (raw input) }
  const [penalties, setPenalties] = useState({}); // { name: { quit, firstMin, blowout } }

  // ── leaderboard ──
  const [myName, setMyName] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  // ── fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/this_weeks_stats.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const name = data.event?.name || data.event || "";
        setEventName(name);
        setFights(data.fights || []);
        setLeaderboard(loadBoard(name));
        setLoading(false);
      })
      .catch((err) => {
        setError("Could not load fighter data: " + err.message);
        setLoading(false);
      });
  }, []);

  // ── build fighter list with reversed salaries ────────────────────────────
  // Always reversed on this page: the expected low-scorer becomes the most
  // expensive pick, forcing chaos. Works regardless of whether the script was
  // run with DISASTER_MODE=1 (we swap here so the page is self-contained).
  const fighters = useMemo(() => {
    const all = [];
    fights.forEach((fight) => {
      const [f1, f2] = fight.fighters || [];
      if (!f1 || !f2) return;
      // Reverse: each fighter gets the opponent's salary
      all.push({
        ...f1,
        salary: f2.salary, // ← reversed
        realSalary: f1.salary, // original (for reference)
        fightId: String(fight.fight_id ?? fight.matchup),
        matchup: fight.matchup,
        opponent: f2.name,
      });
      all.push({
        ...f2,
        salary: f1.salary, // ← reversed
        realSalary: f2.salary,
        fightId: String(fight.fight_id ?? fight.matchup),
        matchup: fight.matchup,
        opponent: f1.name,
      });
    });
    // Sort most-expensive (reversed) first so chaos candidates are at the top
    return all.sort((a, b) => b.salary - a.salary);
  }, [fights]);

  // ── pick helpers ─────────────────────────────────────────────────────────
  const fightIdOfPick = (name) =>
    fighters.find((f) => f.name === name)?.fightId;

  const togglePick = (name, fightId) => {
    if (myPicks.includes(name)) {
      setMyPicks((p) => p.filter((n) => n !== name));
      return;
    }
    if (myPicks.length >= PICK_COUNT) return; // already full
    // Only one fighter per fight
    const alreadyInFight = myPicks.some((n) => fightIdOfPick(n) === fightId);
    if (alreadyInFight) return;
    setMyPicks((p) => [...p, name]);
  };

  const totalSalary = useMemo(
    () =>
      myPicks.reduce(
        (s, n) => s + (fighters.find((f) => f.name === n)?.salary || 0),
        0,
      ),
    [myPicks, fighters],
  );

  const overCap = totalSalary > SALARY_CAP;
  const ready = myPicks.length === PICK_COUNT && !overCap;

  // ── results helpers ──────────────────────────────────────────────────────
  const adjustedScores = useMemo(
    () =>
      myPicks.map((name) => {
        const raw = parseFloat(realScores[name]) || 0;
        const pen = penaltyTotal(penalties[name]);
        return { name, raw, penalty: pen, adjusted: raw + pen };
      }),
    [myPicks, realScores, penalties],
  );

  const totalAdjusted = adjustedScores.reduce((s, r) => s + r.adjusted, 0);

  const setFlag = (name, flag, val) =>
    setPenalties((prev) => ({
      ...prev,
      [name]: { ...prev[name], [flag]: val },
    }));

  const submitScore = () => {
    const entry = {
      id: Date.now(),
      player: myName.trim() || "Anonymous",
      picks: [...myPicks],
      scores: adjustedScores,
      total: Math.round(totalAdjusted * 10) / 10,
      date: new Date().toLocaleDateString(),
    };
    const updated = [...leaderboard, entry].sort((a, b) => a.total - b.total); // lowest wins
    setLeaderboard(updated);
    saveBoard(eventName, updated);
    setSubmitted(true);
  };

  const clearBoard = () => {
    saveBoard(eventName, []);
    setLeaderboard([]);
  };

  // ── loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <p className="text-red-500 tracking-widest animate-pulse uppercase text-sm">
          Loading Disaster Data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <p className="text-red-400 text-center px-4">{error}</p>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-stone-950 text-stone-100"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* ── Top banner ── */}
      <div className="flex items-center justify-between border-b border-red-900/60 bg-red-950/30 px-6 py-2">
        <span className="text-red-400 text-xs font-black tracking-widest uppercase">
          💀 CHAOS OPS
        </span>
        <span className="text-red-500/50 text-xs tracking-wider hidden sm:block">
          SALARIES REVERSED · BUST CANDIDATES ARE PRICIEST
        </span>
        <span className="text-red-400 text-xs font-black tracking-widest uppercase">
          DISASTER MODE 💀
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
        {/* ── Page header ── */}
        <div className="text-center mb-10">
          <p className="text-xs text-red-900/80 tracking-[0.5em] uppercase mb-2">
            ◆ HIGH-RISK OPERATIONS — CHAOS DIVISION ◆
          </p>
          <h1
            className="text-4xl md:text-6xl font-black tracking-wider uppercase mb-1"
            style={{
              fontFamily: "'Impact', sans-serif",
              color: "#ef4444",
              textShadow: "2px 2px 0 #7f1d1d, 0 0 40px rgba(239,68,68,0.3)",
            }}
          >
            💀 DISASTER PICKS
          </h1>
          <p className="text-stone-400 mt-3 text-sm leading-relaxed max-w-lg mx-auto">
            Pick 6 fighters most likely to{" "}
            <strong className="text-red-400">tank</strong>. Salaries are{" "}
            <strong className="text-red-400">reversed</strong> — chaos
            candidates are now the most expensive picks. Lowest adjusted score
            wins.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-stone-500">
            <span>🔁 Salaries reversed per matchup</span>
            <span>💸 $50K cap applies</span>
            <span>1 fighter per fight · 6 total</span>
            <span>Lowest adjusted score wins</span>
          </div>
          <div className="w-40 h-px bg-gradient-to-r from-transparent via-red-800 to-transparent mx-auto mt-5" />
        </div>

        {/* ── HOW PENALTIES WORK ── */}
        <div className="bg-red-950/20 border border-red-900/40 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3 text-center">
            ⚠ POST-EVENT BONUS PENALTIES
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
            <div className="bg-stone-900/60 rounded p-3">
              <p className="text-red-400 font-black text-xl mb-1">−50</p>
              <p className="text-stone-300 font-semibold">Quit / No-show</p>
              <p className="text-stone-500 mt-1">
                Fighter pulls out after card starts but before their fight
              </p>
            </div>
            <div className="bg-stone-900/60 rounded p-3">
              <p className="text-red-400 font-black text-xl mb-1">−30</p>
              <p className="text-stone-300 font-semibold">1st-Minute Finish</p>
              <p className="text-stone-500 mt-1">
                Lost by KO/TKO/Sub in the opening minute of Rd 1
              </p>
            </div>
            <div className="bg-stone-900/60 rounded p-3">
              <p className="text-red-400 font-black text-xl mb-1">−20</p>
              <p className="text-stone-300 font-semibold">Blowout Loss</p>
              <p className="text-stone-500 mt-1">
                Lost by more than 100 DK fantasy points to their opponent
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1 — PICK YOUR FIGHTERS
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-red-900/40" />
            <span className="text-xs font-bold tracking-[0.4em] uppercase text-red-600">
              STEP 1 — PICK YOUR 6
            </span>
            <div className="h-px flex-1 bg-red-900/40" />
          </div>

          {/* Salary tracker */}
          <div className="flex items-center justify-between bg-stone-900/60 border border-stone-800 rounded-lg px-4 py-3 mb-4">
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-0.5">
                Picks
              </p>
              <p className="text-lg font-black">
                <span
                  className={
                    myPicks.length === PICK_COUNT
                      ? "text-green-400"
                      : "text-stone-100"
                  }
                >
                  {myPicks.length}
                </span>
                <span className="text-stone-600"> / {PICK_COUNT}</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-0.5">
                Salary Used
              </p>
              <p
                className={`text-lg font-black ${overCap ? "text-red-400" : "text-stone-100"}`}
              >
                ${totalSalary.toLocaleString()}
                <span className="text-stone-600 text-sm"> / $50,000</span>
              </p>
              {overCap && (
                <p className="text-red-400 text-[10px] font-bold uppercase">
                  Over cap!
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500 uppercase tracking-wider mb-0.5">
                Remaining
              </p>
              <p
                className={`text-lg font-black ${overCap ? "text-red-400" : "text-green-400"}`}
              >
                ${(SALARY_CAP - totalSalary).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Fighter list */}
          <div className="space-y-1.5">
            {fights.map((fight) => {
              const [f1raw, f2raw] = fight.fighters || [];
              if (!f1raw || !f2raw) return null;
              const fightId = String(fight.fight_id ?? fight.matchup);

              // Build reversed fighters for this fight
              const f1 = {
                ...f1raw,
                salary: f2raw.salary,
                realSalary: f1raw.salary,
              };
              const f2 = {
                ...f2raw,
                salary: f1raw.salary,
                realSalary: f2raw.salary,
              };

              const pickInFight = myPicks.find((n) =>
                [f1.name, f2.name].includes(n),
              );

              return (
                <div
                  key={fightId}
                  className="bg-stone-900/50 border border-stone-800 rounded-lg overflow-hidden"
                >
                  {/* Fight label */}
                  <div className="px-3 py-1.5 bg-stone-800/60 border-b border-stone-700/60 flex items-center justify-between">
                    <span className="text-[10px] text-stone-500 tracking-widest uppercase">
                      {fight.matchup || `Fight ${fight.fight_id}`}
                    </span>
                    {fight.weight_class && fight.weight_class !== "N/A" && (
                      <span className="text-[10px] text-stone-600">
                        {fight.weight_class}
                      </span>
                    )}
                  </div>

                  {/* Two fighters side by side */}
                  <div className="grid grid-cols-2 divide-x divide-stone-800">
                    {[f1, f2].map((f) => {
                      const isPicked = myPicks.includes(f.name);
                      const isDisabled =
                        !isPicked &&
                        (myPicks.length >= PICK_COUNT ||
                          (!!pickInFight && pickInFight !== f.name));
                      const salaryAfterPick = overCap
                        ? totalSalary
                        : totalSalary + (isPicked ? 0 : f.salary);
                      const wouldExceedCap =
                        !isPicked && salaryAfterPick > SALARY_CAP;
                      const actuallyDisabled = isDisabled || wouldExceedCap;

                      return (
                        <button
                          key={f.name}
                          onClick={() =>
                            !actuallyDisabled && togglePick(f.name, fightId)
                          }
                          disabled={actuallyDisabled}
                          className={`px-3 py-3 text-left w-full transition focus:outline-none ${
                            isPicked
                              ? "bg-red-900/40 border-l-2 border-red-500"
                              : actuallyDisabled
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-stone-800/60 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-bold truncate ${isPicked ? "text-red-300" : "text-stone-100"}`}
                              >
                                {isPicked && <span className="mr-1">💀</span>}
                                {f.name}
                              </p>
                              {f.record && f.record !== "N/A" && (
                                <p className="text-[10px] text-stone-500 mt-0.5">
                                  {f.record}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p
                                className={`text-sm font-black ${isPicked ? "text-red-400" : "text-red-500"}`}
                              >
                                ${f.salary?.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-stone-600">
                                DK: ${f.realSalary?.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {isPicked && (
                            <p className="text-[10px] text-red-500/70 mt-1 uppercase tracking-wider">
                              ✓ Selected — click to remove
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2 — MY LINEUP
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-red-900/40" />
            <span className="text-xs font-bold tracking-[0.4em] uppercase text-red-600">
              STEP 2 — MY LINEUP
            </span>
            <div className="h-px flex-1 bg-red-900/40" />
          </div>

          {myPicks.length === 0 ? (
            <p className="text-stone-600 text-center text-sm py-6">
              No fighters selected yet. Pick 6 above (one per fight).
            </p>
          ) : (
            <div className="bg-stone-900/60 border border-red-900/30 rounded-lg overflow-hidden mb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-800/80 text-stone-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-2">Fighter</th>
                    <th className="text-right px-4 py-2">Disaster Salary</th>
                    <th className="text-right px-4 py-2">DK Salary</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {myPicks.map((name) => {
                    const f = fighters.find((x) => x.name === name);
                    return (
                      <tr key={name} className="border-t border-stone-800">
                        <td className="px-4 py-2.5 font-semibold text-red-300">
                          💀 {name}
                        </td>
                        <td className="px-4 py-2.5 text-right text-red-400 font-bold">
                          ${f?.salary?.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-stone-600 text-xs">
                          ${f?.realSalary?.toLocaleString()}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <button
                            onClick={() =>
                              setMyPicks((p) => p.filter((n) => n !== name))
                            }
                            className="text-xs text-stone-600 hover:text-red-400 transition px-1"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-stone-700 bg-stone-800/40">
                    <td className="px-4 py-2 text-xs text-stone-500 uppercase tracking-wider">
                      Total
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-black ${overCap ? "text-red-400" : "text-stone-100"}`}
                    >
                      ${totalSalary.toLocaleString()}
                      {overCap && " ⚠ OVER CAP"}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Lock-in / Results toggle */}
          <div className="flex flex-col items-center gap-3">
            {ready && !showResults && (
              <button
                onClick={() => setShowResults(true)}
                className="px-8 py-3 rounded font-black text-sm tracking-widest uppercase bg-red-700 hover:bg-red-600 text-white transition shadow-lg shadow-red-900/40"
              >
                💀 Lock In & Enter Results
              </button>
            )}
            {!ready && myPicks.length < PICK_COUNT && (
              <p className="text-stone-600 text-xs text-center">
                Select {PICK_COUNT - myPicks.length} more fighter
                {PICK_COUNT - myPicks.length !== 1 ? "s" : ""} to lock in.
              </p>
            )}
            {overCap && (
              <p className="text-red-400 text-xs font-bold text-center">
                Lineup is over the $50,000 salary cap. Remove a fighter to
                continue.
              </p>
            )}
            {showResults && (
              <button
                onClick={() => setShowResults(false)}
                className="text-xs text-stone-600 hover:text-stone-400 transition"
              >
                ← Back to Pick Phase
              </button>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 3 — RESULTS ENTRY
        ═══════════════════════════════════════════════════════════════════ */}
        {showResults && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-red-900/40" />
              <span className="text-xs font-bold tracking-[0.4em] uppercase text-red-600">
                STEP 3 — ENTER RESULTS
              </span>
              <div className="h-px flex-1 bg-red-900/40" />
            </div>

            <p className="text-stone-500 text-xs text-center mb-6">
              Enter each fighter's actual DK score after their fight, then check
              any applicable penalties. Adjusted score updates live.{" "}
              <strong className="text-red-400">Lowest total wins.</strong>
            </p>

            <div className="space-y-3 mb-8">
              {myPicks.map((name) => {
                const f = fighters.find((x) => x.name === name);
                const p = penalties[name] || {};
                const rawVal = parseFloat(realScores[name]) || 0;
                const pen = penaltyTotal(p);
                const adjusted = rawVal + pen;

                return (
                  <div
                    key={name}
                    className={`rounded-lg border overflow-hidden transition ${
                      pen < 0
                        ? "border-red-700/60 bg-red-950/20"
                        : "border-stone-700/60 bg-stone-900/40"
                    }`}
                  >
                    {/* Fighter header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-800/60">
                      <div>
                        <span className="font-bold text-red-300">
                          💀 {name}
                        </span>
                        {f?.opponent && (
                          <span className="text-stone-600 text-xs ml-2">
                            vs {f.opponent}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        {realScores[name] !== undefined &&
                        realScores[name] !== "" ? (
                          <>
                            <span className="text-xs text-stone-500 mr-2">
                              Raw:{" "}
                              <span className="text-stone-300">{rawVal}</span>
                            </span>
                            {pen !== 0 && (
                              <span className="text-xs text-red-400 mr-2">
                                Pen: {pen}
                              </span>
                            )}
                            <span
                              className={`text-sm font-black ${adjusted < 0 ? "text-red-500" : adjusted < 30 ? "text-orange-400" : "text-stone-100"}`}
                            >
                              {Math.round(adjusted * 10) / 10} pts
                            </span>
                          </>
                        ) : (
                          <span className="text-stone-700 text-xs">
                            awaiting score
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* DK score input */}
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs text-stone-500 whitespace-nowrap">
                          DK Score:
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={realScores[name] ?? ""}
                          onChange={(e) =>
                            setRealScores((prev) => ({
                              ...prev,
                              [name]: e.target.value,
                            }))
                          }
                          className="w-24 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-sm text-stone-100 focus:border-red-700 focus:outline-none"
                        />
                      </div>

                      {/* Penalty checkboxes */}
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-stone-400 hover:text-red-400 transition">
                          <input
                            type="checkbox"
                            checked={!!p.quit}
                            onChange={(e) =>
                              setFlag(name, "quit", e.target.checked)
                            }
                            className="accent-red-500 w-3.5 h-3.5"
                          />
                          Quit/No-show
                          <span className="text-red-500 font-bold ml-0.5">
                            −50
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-stone-400 hover:text-red-400 transition">
                          <input
                            type="checkbox"
                            checked={!!p.firstMin}
                            onChange={(e) =>
                              setFlag(name, "firstMin", e.target.checked)
                            }
                            className="accent-red-500 w-3.5 h-3.5"
                          />
                          1st-min KO/TKO/Sub
                          <span className="text-red-500 font-bold ml-0.5">
                            −30
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-stone-400 hover:text-red-400 transition">
                          <input
                            type="checkbox"
                            checked={!!p.blowout}
                            onChange={(e) =>
                              setFlag(name, "blowout", e.target.checked)
                            }
                            className="accent-red-500 w-3.5 h-3.5"
                          />
                          &gt;100pt blowout
                          <span className="text-red-500 font-bold ml-0.5">
                            −20
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total adjusted score */}
            <div className="bg-red-950/30 border border-red-800/40 rounded-lg px-6 py-4 mb-6 text-center">
              <p className="text-xs text-red-700 uppercase tracking-widest mb-1">
                Total Adjusted Score
              </p>
              <p className="text-5xl font-black text-red-400">
                {Math.round(totalAdjusted * 10) / 10}
              </p>
              <p className="text-stone-500 text-xs mt-1">
                Lower is better — chaos candidates score badly, you win.
              </p>
            </div>

            {/* Submit */}
            {!submitted ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  className="bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm text-stone-100 focus:border-red-700 focus:outline-none w-48"
                />
                <button
                  onClick={submitScore}
                  className="px-6 py-2 rounded font-black text-sm tracking-widest uppercase bg-red-700 hover:bg-red-600 text-white transition"
                >
                  Submit Score
                </button>
              </div>
            ) : (
              <p className="text-green-400 text-center font-bold text-sm">
                ✓ Score submitted! See leaderboard below.
              </p>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 4 — LEADERBOARD
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-red-900/40" />
            <span className="text-xs font-bold tracking-[0.4em] uppercase text-red-600">
              LEADERBOARD — LOWEST WINS
            </span>
            <div className="h-px flex-1 bg-red-900/40" />
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-stone-700 text-center text-sm py-6">
              No scores yet — be the first to submit!
            </p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-4 rounded-lg border px-4 py-3 ${
                    i === 0
                      ? "border-yellow-600/50 bg-yellow-950/20"
                      : "border-stone-800 bg-stone-900/40"
                  }`}
                >
                  <div className="text-2xl font-black w-8 shrink-0 text-center">
                    {i === 0
                      ? "🏆"
                      : i === 1
                        ? "🥈"
                        : i === 2
                          ? "🥉"
                          : `#${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span
                        className={`font-black text-sm ${i === 0 ? "text-yellow-400" : "text-stone-100"}`}
                      >
                        {entry.player}
                      </span>
                      <span
                        className={`font-black text-lg ${i === 0 ? "text-yellow-400" : "text-red-400"}`}
                      >
                        {entry.total} pts
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-600">
                      {(entry.picks || []).map((name) => {
                        const scoreInfo = (entry.scores || []).find(
                          (s) => s.name === name,
                        );
                        return (
                          <span key={name}>
                            💀 {name}
                            {scoreInfo && (
                              <span className="text-stone-700 ml-0.5">
                                ({Math.round(scoreInfo.adjusted * 10) / 10})
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-stone-700 mt-1">
                      {entry.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {leaderboard.length > 0 && (
            <div className="text-center mt-6">
              <p className="text-[10px] text-stone-700 mb-2">
                Leaderboard stored in this browser only. Clearing resets all
                entries.
              </p>
              <button
                onClick={clearBoard}
                className="text-xs px-3 py-1 rounded bg-stone-900 border border-stone-800 text-stone-600 hover:text-red-400 hover:border-red-900 transition"
              >
                Clear leaderboard
              </button>
            </div>
          )}
        </section>

        {/* ── Footer nav ── */}
        <div className="text-center pb-6">
          <Link
            to="/predictions"
            className="text-xs text-stone-600 hover:text-yellow-500 transition underline underline-offset-2"
          >
            ← Back to serious DFS projections
          </Link>
        </div>
      </div>
    </div>
  );
}
