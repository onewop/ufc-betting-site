import { useState, useEffect, useMemo } from "react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function eventRecord(fights) {
  const final = fights.filter((f) => f.result !== null);
  const wins = final.filter((f) => f.our_pick === f.result).length;
  return { wins, losses: final.length - wins, total: final.length };
}

function pct(wins, total) {
  if (!total) return "—";
  return ((wins / total) * 100).toFixed(1) + "%";
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── sub-components ───────────────────────────────────────────────────────────

function FightRow({ fight }) {
  const isPending = fight.result === null || fight.result === undefined;
  const isCorrect = !isPending && fight.our_pick === fight.result;
  const isWrong = !isPending && fight.our_pick !== fight.result;

  return (
    <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_1fr_1fr_auto] items-center gap-x-3 gap-y-1 py-2.5 border-b border-stone-800/60 last:border-0">
      {/* Bout */}
      <div>
        <p className="text-xs sm:text-sm font-semibold text-stone-200 leading-tight">
          {fight.bout}
        </p>
        {fight.weight_class && (
          <p className="text-[10px] text-stone-500 mt-0.5">{fight.weight_class}</p>
        )}
      </div>

      {/* Our pick */}
      <div className="hidden sm:block">
        <p className="text-[11px] text-stone-500 uppercase tracking-widest mb-0.5">
          Our Pick
        </p>
        <p
          className={`text-xs font-bold ${
            isCorrect
              ? "text-emerald-400"
              : isWrong
                ? "text-red-400"
                : "text-yellow-300"
          }`}
        >
          {fight.our_pick || "—"}
        </p>
      </div>

      {/* Result */}
      <div className="hidden sm:block">
        <p className="text-[11px] text-stone-500 uppercase tracking-widest mb-0.5">
          Result
        </p>
        <p className="text-xs font-bold text-stone-300">
          {isPending ? (
            <span className="text-yellow-600">PENDING</span>
          ) : (
            <>
              {fight.result}
              {fight.method && (
                <span className="text-stone-500 font-normal ml-1">
                  · {fight.method}
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Verdict badge */}
      <div className="flex items-center justify-end">
        {isPending ? (
          <span className="text-[10px] font-mono px-2 py-1 rounded-full bg-yellow-900/30 border border-yellow-700/40 text-yellow-500 tracking-widest">
            PENDING
          </span>
        ) : isCorrect ? (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-700/40 text-emerald-400">
            ✓ CORRECT
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-900/30 border border-red-800/40 text-red-400">
            ✗ WRONG
          </span>
        )}
      </div>

      {/* Mobile pick + result row */}
      <div className="col-span-3 flex gap-4 sm:hidden text-[11px] text-stone-500">
        <span>
          Pick:{" "}
          <span
            className={`font-bold ${isCorrect ? "text-emerald-400" : isWrong ? "text-red-400" : "text-yellow-300"}`}
          >
            {fight.our_pick?.split(" ").pop() || "—"}
          </span>
        </span>
        {!isPending && (
          <span>
            Won:{" "}
            <span className="font-bold text-stone-300">
              {fight.result?.split(" ").pop()}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }) {
  const [open, setOpen] = useState(false);
  const rec = eventRecord(event.fights);
  const accuracy = rec.total > 0 ? (rec.wins / rec.total) * 100 : null;
  const isPending = event.status !== "final";

  const barColor =
    accuracy === null
      ? "bg-yellow-700"
      : accuracy >= 65
        ? "bg-emerald-500"
        : accuracy >= 50
          ? "bg-yellow-500"
          : "bg-red-500";

  return (
    <div
      className={`bg-stone-900 border rounded-2xl overflow-hidden transition-all duration-200 ${
        open
          ? "border-yellow-500 shadow-[0_0_24px_rgba(202,138,4,0.2)]"
          : "border-stone-700 hover:border-yellow-700/50"
      }`}
    >
      {/* Event header row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 group"
      >
        {/* Date */}
        <div className="hidden sm:block w-28 shrink-0">
          <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
            Date
          </p>
          <p className="text-xs text-stone-300 mt-0.5">{fmtDate(event.date)}</p>
        </div>

        {/* Event name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-bold text-white truncate">
            {event.event}
          </p>
          <p className="text-[10px] font-mono text-stone-500 mt-0.5 sm:hidden">
            {fmtDate(event.date)}
          </p>
        </div>

        {/* Record badge */}
        {!isPending && rec.total > 0 && (
          <div className="shrink-0 text-center">
            <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
              Record
            </p>
            <p className="text-sm font-black text-white mt-0.5">
              <span className="text-emerald-400">{rec.wins}</span>
              <span className="text-stone-600">-</span>
              <span className="text-red-400">{rec.losses}</span>
            </p>
          </div>
        )}

        {/* Accuracy bar */}
        {!isPending && accuracy !== null && (
          <div className="hidden sm:block w-32 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-stone-500 uppercase">
                Accuracy
              </span>
              <span className="text-[11px] font-bold text-stone-300">
                {pct(rec.wins, rec.total)}
              </span>
            </div>
            <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                style={{ width: `${accuracy}%` }}
              />
            </div>
          </div>
        )}

        {isPending && (
          <span className="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-full bg-yellow-900/30 border border-yellow-700/40 text-yellow-500 tracking-widest">
            UPCOMING
          </span>
        )}

        {/* Chevron */}
        <span
          className={`shrink-0 text-stone-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {/* Expanded fight list */}
      {open && (
        <div className="border-t border-stone-800 px-5 py-3">
          <div className="divide-y-0">
            {event.fights.map((fight, i) => (
              <FightRow key={i} fight={fight} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, sub, color = "text-yellow-400" }) {
  return (
    <div className="bg-stone-900 border border-stone-700 rounded-2xl p-4 sm:p-5 text-center">
      <div className={`text-2xl sm:text-3xl font-black ${color}`}>{value}</div>
      {sub && (
        <div className="text-stone-500 text-[10px] font-mono mt-0.5">{sub}</div>
      )}
      <div className="text-stone-400 text-[11px] uppercase tracking-widest mt-1">
        {label}
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function PredictionTrackRecord() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/track_record.json")
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load track record data.");
        setLoading(false);
      });
  }, []);

  // Aggregate stats across all final events
  const stats = useMemo(() => {
    if (!data) return null;
    let totalWins = 0;
    let totalLosses = 0;
    let eventsRecorded = 0;

    data.events.forEach((ev) => {
      if (ev.status !== "final") return;
      const rec = eventRecord(ev.fights);
      if (rec.total === 0) return;
      totalWins += rec.wins;
      totalLosses += rec.losses;
      eventsRecorded++;
    });

    const total = totalWins + totalLosses;
    return { totalWins, totalLosses, total, eventsRecorded };
  }, [data]);

  return (
    <div className="min-h-screen bg-stone-950 text-white pb-24">
      {/* ── Page header ── */}
      <div className="relative border-b border-yellow-700/30 bg-stone-950 px-6 py-10 text-center overflow-hidden">
        {/* Decorative grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #ca8a04 0, #ca8a04 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #ca8a04 0, #ca8a04 1px, transparent 1px, transparent 40px)",
          }}
        />
        <p className="text-[10px] font-mono text-yellow-600 tracking-[0.4em] uppercase mb-2">
          ◆ CLASSIFIED INTEL ◆
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          AI Prediction
          <span className="text-yellow-400"> Track Record</span>
        </h1>
        <p className="text-stone-400 text-sm mt-2 max-w-md mx-auto">
          Every pick our AI made, verified against real outcomes.
          {data?.season_label && (
            <span className="text-yellow-500/70"> {data.season_label}.</span>
          )}
        </p>
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-4" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        {/* ── Loading / error states ── */}
        {loading && (
          <div className="text-center py-16">
            <p className="text-stone-500 text-sm animate-pulse font-mono tracking-widest">
              LOADING INTEL…
            </p>
          </div>
        )}
        {error && (
          <div className="text-center py-16">
            <p className="text-stone-500 text-sm">{error}</p>
          </div>
        )}

        {/* ── Stats banner ── */}
        {stats && (
          <div className="mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <StatPill
                label={`${data.season_label ?? "Season"} Record`}
                value={`${stats.totalWins}-${stats.totalLosses}`}
                color="text-white"
              />
              <StatPill
                label="Accuracy"
                value={pct(stats.totalWins, stats.total)}
                sub={`${stats.total} fights graded`}
                color={
                  stats.totalWins / stats.total >= 0.65
                    ? "text-emerald-400"
                    : stats.totalWins / stats.total >= 0.5
                      ? "text-yellow-400"
                      : "text-red-400"
                }
              />
              <StatPill
                label="Events Graded"
                value={stats.eventsRecorded}
                color="text-yellow-400"
              />
              <StatPill
                label="Correct Picks"
                value={stats.totalWins}
                sub={`${stats.totalLosses} missed`}
                color="text-emerald-400"
              />
            </div>

            {/* Overall progress bar */}
            <div className="mt-4 bg-stone-900 border border-stone-700 rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
                  Overall Accuracy
                </span>
                <span className="text-xs font-bold text-stone-300">
                  {stats.totalWins} correct of {stats.total} picks
                </span>
              </div>
              <div className="h-3 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-700 to-yellow-400 rounded-full transition-all duration-700"
                  style={{
                    width: `${stats.total ? (stats.totalWins / stats.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] font-mono text-yellow-600">0%</span>
                <span className="text-[10px] font-mono text-yellow-600">
                  {pct(stats.totalWins, stats.total)} win rate
                </span>
                <span className="text-[10px] font-mono text-yellow-600">
                  100%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Event list ── */}
        {data && (
          <div className="space-y-3">
            <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest mb-4">
              ▼ Click any event to expand fight-by-fight results
            </p>
            {data.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        {/* ── Footer note ── */}
        {data && (
          <p className="text-center text-[10px] font-mono text-stone-600 mt-10">
            PICKS GENERATED BY COMBAT VAULT AI · UPDATED WEEKLY AFTER EACH EVENT
          </p>
        )}
      </div>
    </div>
  );
}
