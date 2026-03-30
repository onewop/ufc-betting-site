import { useState, useEffect } from "react";
import "tailwindcss/tailwind.css"; // or your correct Tailwind import path

const generalQuestions = [
  "Who has the striking advantage?",
  "Who lands more strikes per minute?",
  "Compare striking accuracy.",
  "Who has better striking defense?",
  "Who has the grappling / wrestling edge?",
  "How does each fighter's takedown offense compare to the other's defense?",
  "Analyze takedown defense statistics.",
  "Who has more submission wins?",
  "Compare their win/loss records.",
  "Who has the better finish rate?",
  "Who wins by KO/TKO more often?",
  "Who is on the better win streak?",
  "Compare reach and physical attributes.",
  "What is the DFS salary value breakdown?",
  "Who wins? Overall fight prediction.",
];

// ─── Matchup Intel helpers (shared with DFSPicksProjections) ────────────────
const _parsePct = (v) => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace("%", ""));
  return isNaN(n) ? null : n;
};

const _evalAngle = (label, attackerVal, defenderDefPct) => {
  if (attackerVal == null || defenderDefPct == null)
    return { level: "neutral", label, tip: "No data available" };
  if (defenderDefPct === 0)
    return {
      level: "neutral",
      label,
      tip: `${attackerVal > 0 ? attackerVal : "no data"} output vs 0% defense (small sample — insufficient data)`,
    };
  if (attackerVal === 0)
    return {
      level: "neutral",
      label,
      tip: `No attempts on record vs ${defenderDefPct}% defense`,
    };
  if (defenderDefPct < 50)
    return {
      level: "strong",
      label,
      tip: `${attackerVal} output vs ${defenderDefPct}% defense — clear exploit`,
    };
  if (defenderDefPct < 65)
    return {
      level: "moderate",
      label,
      tip: `${attackerVal} output vs ${defenderDefPct}% defense — potential edge`,
    };
  return {
    level: "neutral",
    label,
    tip: `${attackerVal} output vs ${defenderDefPct}% defense — no clear edge`,
  };
};

// Evaluate submission threat using actual career submission wins as the primary
// metric. avg_sub_attempts is shown as secondary context only.
const _evalSubAngle = (
  attackerWins,
  attackerAttempts,
  defenderWins,
  defenderAttempts,
) => {
  const label = "Submissions";
  const wins = attackerWins ?? 0;
  const atts = Number((attackerAttempts ?? 0).toFixed(1));
  const oppWins = defenderWins ?? 0;
  const tip = `${wins} sub win${wins !== 1 ? "s" : ""} (${atts} attempts/fight)`;
  if (wins === 0)
    return {
      level: "neutral",
      label,
      tip: `0 sub wins (${atts} attempts/fight)`,
    };
  if (wins >= 3 && wins >= oppWins * 2) return { level: "strong", label, tip };
  if (wins > oppWins) return { level: "moderate", label, tip };
  return { level: "neutral", label, tip };
};

const _computeAngles = (f1, f2) => {
  const s1 = f1.stats || {};
  const s2 = f2.stats || {};
  const subWins1 = f1.wins_submission ?? 0;
  const subWins2 = f2.wins_submission ?? 0;
  const subAtt1 = f1.avg_sub_attempts ?? s1.avg_sub_attempts ?? 0;
  const subAtt2 = f2.avg_sub_attempts ?? s2.avg_sub_attempts ?? 0;
  return [
    {
      attacker: f1.name,
      defender: f2.name,
      angles: [
        _evalAngle("Striking", s1.slpm, _parsePct(s2.striking_defense)),
        _evalAngle("Wrestling", s1.td_avg, _parsePct(s2.td_defense)),
        _evalSubAngle(subWins1, subAtt1, subWins2, subAtt2),
      ],
    },
    {
      attacker: f2.name,
      defender: f1.name,
      angles: [
        _evalAngle("Striking", s2.slpm, _parsePct(s1.striking_defense)),
        _evalAngle("Wrestling", s2.td_avg, _parsePct(s1.td_defense)),
        _evalSubAngle(subWins2, subAtt2, subWins1, subAtt1),
      ],
    },
  ];
};

const _LEVEL = {
  strong: {
    dot: "bg-red-500",
    border: "border-red-700/60",
    bg: "bg-red-950/50",
    badge: "bg-red-700 text-red-100",
    label: "Exploit",
  },
  moderate: {
    dot: "bg-orange-400",
    border: "border-orange-700/50",
    bg: "bg-orange-950/30",
    badge: "bg-orange-800 text-orange-100",
    label: "Edge",
  },
  neutral: {
    dot: "bg-stone-600",
    border: "border-stone-700",
    bg: "bg-stone-900/40",
    badge: "bg-stone-700 text-stone-300",
    label: "Even",
  },
};

const FightAnalyzer = ({ eventTitle = "Latest UFC Event" }) => {
  const [fighters, setFighters] = useState([]);
  const [fights, setFights] = useState([]);
  const [selectedFight, setSelectedFight] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [cachedOdds, setCachedOdds] = useState([]);
  const [expandedStats, setExpandedStats] = useState(false);
  const [activeTab, setActiveTab] = useState("basics");

  useEffect(() => {
    console.log("🔍 Starting fetch for /this_weeks_stats.json");
    setError(null); // Clear previous errors

    console.log("📡 Initiating fetch with cache: no-store");
    fetch("/this_weeks_stats.json", {
      cache: "no-store", // Bypass cache
      headers: {
        Accept: "application/json",
      },
    })
      .then((res) => {
        console.log("📊 Response received:", {
          status: res.status,
          ok: res.ok,
          statusText: res.statusText,
          contentType: res.headers.get("Content-Type"),
        });

        if (!res.ok) {
          throw new Error(
            `HTTP error! Status: ${res.status} ${res.statusText}`,
          );
        }

        return res.text(); // Get raw text first to debug
      })
      .then((text) => {
        console.log(
          "📄 Raw response (first 500 chars):",
          text.substring(0, 500),
        );
        console.log("   Total response length:", text.length, "bytes");

        try {
          const data = JSON.parse(text);
          console.log("✅ JSON.parse succeeded!");
          console.log("   Data structure keys:", Object.keys(data));
          console.log(
            "   Fights array length:",
            data.fights?.length || "missing",
          );
          console.log("   Full parsed data:", data);
          if (data.fights && data.fights.length > 0) {
            console.log("   First fight:", data.fights[0]);
            console.log(
              "   First fighter stats:",
              data.fights[0].fighters?.[0]?.stats,
            );
          }

          // Use data.fights (correct structure from JSON)
          const rawFights = data.fights || [];

          // Add fight_id to each fight and map fighter data
          const processedFights = rawFights.map((fight, index) => ({
            fight_id: index,
            matchup: fight.matchup,
            weight_class: fight.weight_class,
            fighters: (fight.fighters || []).map((f) => ({
              // Spread all fields from JSON first so nothing is lost
              ...f,
              // Normalise the id field used for display/lookup
              id: f.dk_id || f.id || index,
              salary: f.salary,
              avgPointsPerGame: f.avgPointsPerGame || 0,
              // Record — use real values from JSON, never override with 0
              wins: f.wins ?? 0,
              losses: f.losses ?? 0,
              draws: f.draws ?? 0,
              record:
                f.record ||
                (f.wins != null ? `${f.wins}-${f.losses}-${f.draws}` : "N/A"),
              // Physical
              nickname: f.nickname || null,
              height: f.height || "N/A",
              reach: f.reach || "N/A",
              stance: f.stance || "N/A",
              // Career milestones — populated by ufc-master.csv enrichment
              current_win_streak: f.current_win_streak ?? "N/A",
              current_loss_streak: f.current_loss_streak ?? "N/A",
              wins_ko_tko: f.wins_ko_tko ?? "N/A",
              wins_submission: f.wins_submission ?? "N/A",
              wins_decision: f.wins_decision ?? "N/A",
              finish_rate_pct: f.finish_rate_pct ?? "N/A",
              decision_rate_pct: f.decision_rate_pct ?? "N/A",
              // Stats object — keep nested for getValue("stats.slpm") dot-path
              // Spread ALL fields from JSON first so avg_kd_per_fight,
              // avg_ctrl_secs, grappling_control_pct, avg_opp_ctrl_secs,
              // avg_reversals_per_fight, implied_sub_def_pct, etc. are preserved.
              stats: {
                ...f.stats,
                slpm: f.stats?.slpm ?? 0,
                sapm: f.stats?.sapm ?? 0,
                striking_accuracy: f.stats?.striking_accuracy ?? 0,
                striking_defense: f.stats?.striking_defense ?? "N/A",
                td_avg: f.stats?.td_avg ?? 0,
                td_accuracy: f.stats?.td_accuracy ?? 0,
                td_defense: f.stats?.td_defense ?? "N/A",
              },
              // Flat aliases used by processQuestion helpers
              striking_accuracy: f.stats?.striking_accuracy ?? 0,
              takedown_accuracy: f.stats?.td_accuracy ?? 0,
            })),
          }));

          console.log("🥊 Processed fights (with fight_id):", processedFights);

          setFights(processedFights);

          // Flatten fighters for setFighters if needed
          const allFighters = processedFights.flatMap(
            (fight) => fight.fighters || [],
          );
          setFighters(allFighters);
          console.log("👥 All fighters flattened:", allFighters);

          setLoading(false);
          console.log("✨ Fetch complete - loading set to false");
        } catch (parseErr) {
          console.error("❌ JSON.parse failed!");
          console.error("   Error message:", parseErr.message);
          console.error("   Error stack:", parseErr.stack);
          throw new Error("Invalid JSON format: " + parseErr.message);
        }
      })
      .catch((err) => {
        console.error("💥 Fetch error:", err.message);
        console.error("   Full error object:", err);
        setError("Failed to load fighters: " + err.message);
        setLoading(false);
      });

    // Load live odds from localStorage cache (populated by LatestOdds page)
    try {
      const cached = JSON.parse(localStorage.getItem("ufc_odds_cache_v3"));
      if (cached?.data) setCachedOdds(cached.data);
    } catch (_) {}

    // Separate fetch for live data
    fetch(
      "https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?c=United%20States&s=Mixed_Martial_Arts",
    )
      .then((res) => res.json())
      .then((data) => setLiveData(data))
      .catch(() => console.log("Live data fetch failed."));
  }, []);

  const processQuestion = (questionOverride) => {
    const activeQuestion = questionOverride ?? question;
    if (!selectedFight || !activeQuestion) {
      setAnswer("Please select a fight and enter a question.");
      return;
    }

    const fight = fights.find((f) => f.fight_id === parseInt(selectedFight));
    if (!fight) {
      setAnswer("Fight not found.");
      return;
    }

    const [f1, f2] = fight.fighters;
    const q = activeQuestion.toLowerCase();
    const s1 = f1.stats || {};
    const s2 = f2.stats || {};

    // ── Stat helpers ──────────────────────────────────────────────────────────
    const num = (v) => {
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };
    const pct = (v) => {
      if (v == null) return null;
      const n = parseFloat(String(v).replace("%", ""));
      return isNaN(n) ? null : n;
    };
    const fmt = (v, suffix = "") => (v != null ? `${v}${suffix}` : "N/A");
    const edgeName = (a, b, higherBetter = true) => {
      if (a == null || b == null) return null;
      if (higherBetter) return a > b ? f1.name : b > a ? f2.name : "Even";
      return a < b ? f1.name : b < a ? f2.name : "Even";
    };

    // ── JSX helpers ───────────────────────────────────────────────────────────
    const StatRow = ({ label, v1, v2, note, winner }) => (
      <tr className="border-b border-stone-700/40">
        <td className="py-1.5 pr-4 text-stone-400 text-xs whitespace-nowrap">
          {label}
        </td>
        <td
          className={`py-1.5 text-center text-xs font-semibold ${winner === f1.name ? "text-green-400" : "text-stone-200"}`}
        >
          {v1}
        </td>
        <td
          className={`py-1.5 text-center text-xs font-semibold ${winner === f2.name ? "text-green-400" : "text-stone-200"}`}
        >
          {v2}
        </td>
        {note && (
          <td className="py-1.5 pl-2 text-stone-500 text-xs italic hidden sm:table-cell">
            {note}
          </td>
        )}
      </tr>
    );
    const StatTable = ({ rows, summary }) => (
      <div>
        <h3 className="text-base font-bold text-stone-100 mb-3">
          {f1.name} <span className="text-stone-500 text-sm mx-1">vs</span>{" "}
          {f2.name}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-600">
                <th className="pb-2 text-stone-500 text-xs font-bold uppercase tracking-wider">
                  Stat
                </th>
                <th className="pb-2 text-center text-yellow-500 text-xs font-bold uppercase tracking-wider">
                  {f1.name.split(" ").pop()}
                </th>
                <th className="pb-2 text-center text-yellow-400/70 text-xs font-bold uppercase tracking-wider">
                  {f2.name.split(" ").pop()}
                </th>
                <th className="pb-2 text-stone-600 text-xs font-bold uppercase tracking-wider hidden sm:table-cell">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-600 italic">
          Per-fight rates (SLpM, SApM, TDs, accuracy) = UFC bouts only &middot;
          Record &amp; finish counts = full pro career
        </p>
        {summary && (
          <p className="mt-3 text-sm text-stone-300 border-t border-stone-700 pt-3 leading-relaxed">
            {summary}
          </p>
        )}
      </div>
    );

    let response;
    try {
      // ── 1. Striking advantage (comprehensive) ─────────────────────────────
      if (
        q.includes("striking advantage") ||
        q.includes("better striker") ||
        q.includes("striking edge") ||
        q.includes("striking style") ||
        q.includes("analyze striking") ||
        q.includes("compare counter")
      ) {
        const slpm1 = num(s1.slpm),
          slpm2 = num(s2.slpm);
        const sapm1 = num(s1.sapm),
          sapm2 = num(s2.sapm);
        const acc1 = pct(s1.striking_accuracy),
          acc2 = pct(s2.striking_accuracy);
        const def1 = pct(s1.striking_defense),
          def2 = pct(s2.striking_defense);
        const sc = { [f1.name]: 0, [f2.name]: 0 };
        const award = (w) => {
          if (w && w !== "Even") sc[w]++;
        };
        award(edgeName(slpm1, slpm2));
        award(edgeName(acc1, acc2));
        award(edgeName(def1, def2));
        award(edgeName(sapm1, sapm2, false));
        const winner =
          sc[f1.name] > sc[f2.name]
            ? f1.name
            : sc[f2.name] > sc[f1.name]
              ? f2.name
              : null;
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="Sig. Strikes Landed / Min (SLpM)"
                  v1={fmt(slpm1)}
                  v2={fmt(slpm2)}
                  note="Higher = more output"
                  winner={edgeName(slpm1, slpm2)}
                />
                <StatRow
                  label="Striking Accuracy %"
                  v1={fmt(acc1, "%")}
                  v2={fmt(acc2, "%")}
                  note="% of sig. strikes that land"
                  winner={edgeName(acc1, acc2)}
                />
                <StatRow
                  label="Striking Defense %"
                  v1={fmt(def1, "%")}
                  v2={fmt(def2, "%")}
                  note="% of opp. strikes blocked/avoided"
                  winner={edgeName(def1, def2)}
                />
                <StatRow
                  label="Sig. Strikes Absorbed / Min (SApM)"
                  v1={fmt(sapm1)}
                  v2={fmt(sapm2)}
                  note="Lower = harder to hit"
                  winner={edgeName(sapm1, sapm2, false)}
                />
              </>
            }
            summary={
              winner
                ? `Striking edge: ${winner} wins ${sc[winner]} of 4 striking categories — more effective volume and harder to hit consistently. Look for them to dictate range and pace.`
                : "Striking is closely matched across all four categories. Execution, footwork, and in-fight adjustments will decide this dimension."
            }
          />
        );
      }

      // ── 2. Strikes per minute ─────────────────────────────────────────────
      else if (
        q.includes("strikes per minute") ||
        q.includes("slpm") ||
        q.includes("lands more strikes")
      ) {
        const slpm1 = num(s1.slpm),
          slpm2 = num(s2.slpm);
        const acc1 = pct(s1.striking_accuracy),
          acc2 = pct(s2.striking_accuracy);
        const w = edgeName(slpm1, slpm2);
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="SLpM (Sig. Strikes Landed / Min)"
                  v1={fmt(slpm1)}
                  v2={fmt(slpm2)}
                  note="Higher = more active striker"
                  winner={w}
                />
                <StatRow
                  label="Striking Accuracy %"
                  v1={fmt(acc1, "%")}
                  v2={fmt(acc2, "%")}
                  note="Volume × accuracy = real threat"
                  winner={edgeName(acc1, acc2)}
                />
              </>
            }
            summary={
              w && w !== "Even"
                ? `${w} throws more strikes per minute. Combined with accuracy, they set a higher-volume pace — constant output pressures opponents into defensive errors and creates late-round openings.`
                : slpm1 == null
                  ? "No SLpM data available for this matchup."
                  : "Similar output from both fighters — timing and accuracy will matter more than volume here."
            }
          />
        );
      }

      // ── 3. Striking accuracy ──────────────────────────────────────────────
      else if (
        q.includes("striking accuracy") ||
        q.includes("compare striking accuracy")
      ) {
        const acc1 = pct(s1.striking_accuracy),
          acc2 = pct(s2.striking_accuracy);
        const slpm1 = num(s1.slpm),
          slpm2 = num(s2.slpm);
        const w = edgeName(acc1, acc2);
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="Striking Accuracy %"
                  v1={fmt(acc1, "%")}
                  v2={fmt(acc2, "%")}
                  note="% of sig. strikes that land (higher = better)"
                  winner={w}
                />
                <StatRow
                  label="SLpM (volume context)"
                  v1={fmt(slpm1)}
                  v2={fmt(slpm2)}
                  note="Volume context"
                  winner={null}
                />
              </>
            }
            summary={
              w && w !== "Even"
                ? `${w} lands a higher percentage of their strikes. Precision means each shot carries more threat — a more accurate striker wastes fewer attempts and connects more cleanly in exchanges.`
                : "Both fighters have similar accuracy. The edge will come from footwork and combination setup rather than raw precision."
            }
          />
        );
      }

      // ── 4. Striking defense ───────────────────────────────────────────────
      else if (
        q.includes("striking defense") ||
        q.includes("absorbs fewer") ||
        q.includes("head movement") ||
        q.includes("evasion")
      ) {
        const def1 = pct(s1.striking_defense),
          def2 = pct(s2.striking_defense);
        const sapm1 = num(s1.sapm),
          sapm2 = num(s2.sapm);
        const w1 = edgeName(def1, def2);
        const w2 = edgeName(sapm1, sapm2, false);
        const agree = w1 === w2 && w1 && w1 !== "Even";
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="Striking Defense %"
                  v1={fmt(def1, "%")}
                  v2={fmt(def2, "%")}
                  note="% of opp. strikes blocked/avoided (higher = better)"
                  winner={w1}
                />
                <StatRow
                  label="SApM (Sig. Strikes Absorbed / Min)"
                  v1={fmt(sapm1)}
                  v2={fmt(sapm2)}
                  note="Lower = harder to hit"
                  winner={w2}
                />
              </>
            }
            summary={
              agree
                ? `${w1} is harder to hit — blocks/avoids more incoming strikes AND absorbs fewer per minute. This durability advantage means they survive exchanges better and accumulate less damage over a full fight.`
                : "Both fighters have similar defensive profiles. Chin, footwork, and fight-week preparation will decide who absorbs damage more effectively."
            }
          />
        );
      }

      // ── 5. Grappling / wrestling edge (comprehensive) ─────────────────────
      else if (
        q.includes("grappling") ||
        q.includes("wrestling") ||
        q.includes("ground game") ||
        q.includes("controls positions") ||
        q.includes("stand-up to ground")
      ) {
        const td1 = num(s1.td_avg),
          td2 = num(s2.td_avg);
        const tdAcc1 = pct(s1.td_accuracy),
          tdAcc2 = pct(s2.td_accuracy);
        const tdDef1 = pct(s1.td_defense),
          tdDef2 = pct(s2.td_defense);
        const ctrl1 = num(s1.avg_ctrl_secs),
          ctrl2 = num(s2.avg_ctrl_secs);
        const sub1 = num(f1.wins_submission),
          sub2 = num(f2.wins_submission);
        const sc = { [f1.name]: 0, [f2.name]: 0 };
        [
          [td1, td2],
          [tdAcc1, tdAcc2],
          [ctrl1, ctrl2],
          [sub1, sub2],
        ].forEach(([a, b]) => {
          if (a != null && b != null) {
            if (a > b) sc[f1.name]++;
            else if (b > a) sc[f2.name]++;
          }
        });
        const winner =
          sc[f1.name] > sc[f2.name]
            ? f1.name
            : sc[f2.name] > sc[f1.name]
              ? f2.name
              : null;
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="TD Avg (takedowns per 15 min)"
                  v1={fmt(td1)}
                  v2={fmt(td2)}
                  note="Higher = more active wrestler"
                  winner={edgeName(td1, td2)}
                />
                <StatRow
                  label="TD Accuracy %"
                  v1={fmt(tdAcc1, "%")}
                  v2={fmt(tdAcc2, "%")}
                  note="% of attempts that succeed"
                  winner={edgeName(tdAcc1, tdAcc2)}
                />
                <StatRow
                  label="TD Defense %"
                  v1={fmt(tdDef1, "%")}
                  v2={fmt(tdDef2, "%")}
                  note="Higher = harder to take down"
                  winner={edgeName(tdDef1, tdDef2)}
                />
                <StatRow
                  label="Avg Control Time (secs)"
                  v1={fmt(ctrl1, "s")}
                  v2={fmt(ctrl2, "s")}
                  note="Ground control per fight"
                  winner={edgeName(ctrl1, ctrl2)}
                />
                <StatRow
                  label="Wins by Submission"
                  v1={fmt(sub1)}
                  v2={fmt(sub2)}
                  winner={edgeName(sub1, sub2)}
                />
              </>
            }
            summary={
              winner
                ? `Grappling edge: ${winner} leads in more mat categories. Their wrestling activity gives them a path to ground control, sustained top pressure, and potential finishes — especially if their opponent's TD defense is below 65%.`
                : "Grappling is closely matched. Neither fighter holds a decisive mat advantage — the fight will likely stay on the feet."
            }
          />
        );
      }

      // ── 6. Takedown offense vs opponent defense ───────────────────────────
      else if (
        q.includes("takedown offense") ||
        q.includes("takedown success") ||
        q.includes("perform against") ||
        q.includes("how does")
      ) {
        const td1 = num(s1.td_avg),
          td2 = num(s2.td_avg);
        const tdDef1 = pct(s1.td_defense),
          tdDef2 = pct(s2.td_defense);
        const levelLabel = (def) =>
          def == null
            ? "No data"
            : def < 50
              ? "🔴 Exploit"
              : def < 65
                ? "🟠 Edge"
                : "⚪ Even";
        const levelClass = (def) =>
          def == null
            ? "text-stone-500"
            : def < 50
              ? "text-red-400 font-bold"
              : def < 65
                ? "text-orange-400 font-bold"
                : "text-stone-400";
        response = (
          <div>
            <h3 className="text-base font-bold text-stone-100 mb-3">
              Takedown Offense vs. Defense
            </h3>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-stone-600">
                    <th className="pb-2 text-stone-500 text-xs font-bold uppercase">
                      Attacking Fighter
                    </th>
                    <th className="pb-2 text-center text-stone-400 text-xs font-bold uppercase">
                      TD Avg (/15m)
                    </th>
                    <th className="pb-2 text-center text-stone-400 text-xs font-bold uppercase">
                      Opp. TD Def %
                    </th>
                    <th className="pb-2 text-center text-stone-400 text-xs font-bold uppercase">
                      Edge
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-stone-700/40">
                    <td className="py-2 pr-3 text-xs text-stone-200 font-semibold">
                      {f1.name}
                    </td>
                    <td className="py-2 text-center text-xs text-stone-200">
                      {fmt(td1)}
                    </td>
                    <td className="py-2 text-center text-xs text-stone-200">
                      {fmt(tdDef2, "%")}
                    </td>
                    <td
                      className={`py-2 text-center text-xs ${levelClass(tdDef2)}`}
                    >
                      {levelLabel(tdDef2)}
                    </td>
                  </tr>
                  <tr className="border-b border-stone-700/40">
                    <td className="py-2 pr-3 text-xs text-stone-200 font-semibold">
                      {f2.name}
                    </td>
                    <td className="py-2 text-center text-xs text-stone-200">
                      {fmt(td2)}
                    </td>
                    <td className="py-2 text-center text-xs text-stone-200">
                      {fmt(tdDef1, "%")}
                    </td>
                    <td
                      className={`py-2 text-center text-xs ${levelClass(tdDef1)}`}
                    >
                      {levelLabel(tdDef1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-stone-500 italic">
              TD Defense % &lt; 50% = clear exploit · &lt; 65% = edge · 65%+ =
              no clear advantage. Also check TD Accuracy % to gauge conversion
              likelihood.
            </p>
          </div>
        );
      }

      // ── 7. Takedown defense ───────────────────────────────────────────────
      else if (
        q.includes("takedown defense") ||
        q.includes("analyze takedown defense")
      ) {
        const tdDef1 = pct(s1.td_defense),
          tdDef2 = pct(s2.td_defense);
        const w = edgeName(tdDef1, tdDef2);
        response = (
          <StatTable
            rows={
              <StatRow
                label="TD Defense %"
                v1={fmt(tdDef1, "%")}
                v2={fmt(tdDef2, "%")}
                note="Higher = harder to take down"
                winner={w}
              />
            }
            summary={
              w && w !== "Even"
                ? `${w} has better takedown defense — harder for opponents to dictate where the fight takes place. This is a major factor if their opponent is a high-volume wrestler.`
                : "Both fighters have similar takedown defense. Wrestling success will come down to timing, setups, and physical matchup."
            }
          />
        );
      }

      // ── 8. Submissions ────────────────────────────────────────────────────
      else if (q.includes("submission")) {
        const sub1 = num(f1.wins_submission),
          sub2 = num(f2.wins_submission);
        const subA1 = num(f1.avg_sub_attempts ?? s1.avg_sub_attempts);
        const subA2 = num(f2.avg_sub_attempts ?? s2.avg_sub_attempts);
        const tdDef1 = pct(s1.td_defense),
          tdDef2 = pct(s2.td_defense);
        const w = edgeName(sub1, sub2);
        const extraNote =
          w === f1.name && tdDef2 != null && tdDef2 < 65
            ? ` ${f2.name}'s ${tdDef2}% TD defense means ${f1.name} can get this to the mat where that sub threat becomes real.`
            : w === f2.name && tdDef1 != null && tdDef1 < 65
              ? ` ${f1.name}'s ${tdDef1}% TD defense means ${f2.name} can get this to the mat where that sub threat becomes real.`
              : "";
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="Wins by Submission"
                  v1={fmt(sub1)}
                  v2={fmt(sub2)}
                  winner={w}
                />
                <StatRow
                  label="Avg Sub Attempts / Fight"
                  v1={fmt(subA1)}
                  v2={fmt(subA2)}
                  note="Volume of submission threats"
                  winner={edgeName(subA1, subA2)}
                />
                <StatRow
                  label="TD Defense % (sub resistance)"
                  v1={fmt(tdDef1, "%")}
                  v2={fmt(tdDef2, "%")}
                  note="Harder to TD = harder to submit"
                  winner={edgeName(tdDef1, tdDef2)}
                />
              </>
            }
            summary={
              w && w !== "Even"
                ? `${w} has more career submission wins and poses the bigger threat on the mat.${extraNote}`
                : sub1 === 0 && sub2 === 0
                  ? "Neither fighter has submission wins on record — this one likely stays on the feet or goes to the scorecards."
                  : "Both fighters have similar submission records. The key variable is who can consistently get the fight to the mat."
            }
          />
        );
      }

      // ── 9. Record / history ───────────────────────────────────────────────
      else if (
        q.includes("record") ||
        q.includes("win-loss") ||
        q.includes("history") ||
        q.includes("highlights") ||
        q.includes("career")
      ) {
        const st1 = Number(f1.current_win_streak) || 0;
        const st2 = Number(f2.current_win_streak) || 0;
        const ls1 = Number(f1.current_loss_streak) || 0;
        const ls2 = Number(f2.current_loss_streak) || 0;
        const stW = st1 > st2 ? f1.name : st2 > st1 ? f2.name : null;
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="Pro Career Record (W-L-D)"
                  v1={f1.record || `${f1.wins}-${f1.losses}-${f1.draws}`}
                  v2={f2.record || `${f2.wins}-${f2.losses}-${f2.draws}`}
                  note="Full pro career (all promotions)"
                  winner={null}
                />
                <StatRow
                  label="UFC Win Streak (UFCStats)"
                  v1={f1.current_win_streak ?? "N/A"}
                  v2={f2.current_win_streak ?? "N/A"}
                  note="Active UFC wins entering fight (pre-UFC wins not included)"
                  winner={stW}
                />
                <StatRow
                  label="UFC Loss Streak (UFCStats)"
                  v1={f1.current_loss_streak ?? "N/A"}
                  v2={f2.current_loss_streak ?? "N/A"}
                  note="Lower = better momentum"
                  winner={
                    ls1 < ls2 && (ls1 || ls2)
                      ? f1.name
                      : ls2 < ls1 && (ls1 || ls2)
                        ? f2.name
                        : null
                  }
                />
                <StatRow
                  label="Last Fight Result"
                  v1={f1.last_fight_result ?? "N/A"}
                  v2={f2.last_fight_result ?? "N/A"}
                  winner={null}
                />
                <StatRow
                  label="UFC Record (Last 5)"
                  v1={f1.record_last_5 ?? "N/A"}
                  v2={f2.record_last_5 ?? "N/A"}
                  note="UFC fights only"
                  winner={null}
                />
                <StatRow
                  label="UFC Record (Last 10)"
                  v1={f1.record_last_10 ?? "N/A"}
                  v2={f2.record_last_10 ?? "N/A"}
                  note="UFC fights only"
                  winner={null}
                />
                <StatRow
                  label="KO / TKO Wins"
                  v1={fmt(num(f1.wins_ko_tko))}
                  v2={fmt(num(f2.wins_ko_tko))}
                  note="Pro career total"
                  winner={edgeName(num(f1.wins_ko_tko), num(f2.wins_ko_tko))}
                />
                <StatRow
                  label="Submission Wins"
                  v1={fmt(num(f1.wins_submission))}
                  v2={fmt(num(f2.wins_submission))}
                  note="Pro career total"
                  winner={edgeName(
                    num(f1.wins_submission),
                    num(f2.wins_submission),
                  )}
                />
              </>
            }
            summary={
              stW
                ? `${stW} enters on a longer active win streak — stronger recent form. Recent performance typically outweighs career record as a predictor, especially when the gap is 2+ fights.`
                : "Both fighters enter in comparable recent form. Focus on the quality of recent opponents and the methods of those wins/losses."
            }
          />
        );
      }

      // ── 10. Finish rate ───────────────────────────────────────────────────
      else if (
        q.includes("finish rate") ||
        q.includes("finishes") ||
        q.includes("who wins by") ||
        q.includes("how does it end")
      ) {
        const finish1 = pct(f1.finish_rate_pct),
          finish2 = pct(f2.finish_rate_pct);
        const dec1 = pct(f1.decision_rate_pct),
          dec2 = pct(f2.decision_rate_pct);
        const ko1 = num(f1.wins_ko_tko),
          ko2 = num(f2.wins_ko_tko);
        const sub1 = num(f1.wins_submission),
          sub2 = num(f2.wins_submission);
        const kd1 = num(s1.avg_kd_per_fight),
          kd2 = num(s2.avg_kd_per_fight);
        const avgDur1 = f1.avg_fight_duration,
          avgDur2 = f2.avg_fight_duration;
        const finishW = edgeName(finish1, finish2);
        const avgF =
          finish1 != null && finish2 != null ? (finish1 + finish2) / 2 : null;
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="Finish Rate %"
                  v1={fmt(finish1, "%")}
                  v2={fmt(finish2, "%")}
                  note="% of wins by KO or Sub (higher = finisher)"
                  winner={finishW}
                />
                <StatRow
                  label="Decision Rate %"
                  v1={fmt(dec1, "%")}
                  v2={fmt(dec2, "%")}
                  note="% of wins by decision"
                  winner={null}
                />
                <StatRow
                  label="KO / TKO Wins"
                  v1={fmt(ko1)}
                  v2={fmt(ko2)}
                  winner={edgeName(ko1, ko2)}
                />
                <StatRow
                  label="Submission Wins"
                  v1={fmt(sub1)}
                  v2={fmt(sub2)}
                  winner={edgeName(sub1, sub2)}
                />
                <StatRow
                  label="Avg Knockdowns / Fight"
                  v1={fmt(kd1)}
                  v2={fmt(kd2)}
                  note="Signals KO power"
                  winner={edgeName(kd1, kd2)}
                />
                <StatRow
                  label="Avg Fight Duration"
                  v1={avgDur1 ?? "N/A"}
                  v2={avgDur2 ?? "N/A"}
                  note="Shorter avg = more stoppages"
                  winner={null}
                />
              </>
            }
            summary={
              finishW && finishW !== "Even"
                ? `${finishW} finishes fights more often (${finishW === f1.name ? finish1 : finish2}% finish rate vs ${finishW === f1.name ? finish2 : finish1}%).${avgF != null && avgF > 60 ? " Both fighters have high finish rates — a decision would be the surprise." : avgF != null && avgF < 35 ? " Both fighters go the distance often — lean toward decision scoring." : ""} Watch for ${finishW} to push for a stoppage rather than coast to the cards.`
                : `Check individual KO wins (${f1.name}: ${ko1 ?? "N/A"}, ${f2.name}: ${ko2 ?? "N/A"}) and sub wins (${f1.name}: ${sub1 ?? "N/A"}, ${f2.name}: ${sub2 ?? "N/A"}) to understand each fighter's preferred finish mode.`
            }
          />
        );
      }

      // ── 11. KO power ──────────────────────────────────────────────────────
      else if (q.includes("ko") || q.includes("knockout")) {
        const ko1 = num(f1.wins_ko_tko),
          ko2 = num(f2.wins_ko_tko);
        const finish1 = pct(f1.finish_rate_pct),
          finish2 = pct(f2.finish_rate_pct);
        const slpm1 = num(s1.slpm),
          slpm2 = num(s2.slpm);
        const kd1 = num(s1.avg_kd_per_fight),
          kd2 = num(s2.avg_kd_per_fight);
        const sapm1 = num(s1.sapm),
          sapm2 = num(s2.sapm);
        const w = edgeName(ko1, ko2);
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="KO / TKO Wins"
                  v1={fmt(ko1)}
                  v2={fmt(ko2)}
                  note="Career stoppages"
                  winner={w}
                />
                <StatRow
                  label="Finish Rate %"
                  v1={fmt(finish1, "%")}
                  v2={fmt(finish2, "%")}
                  winner={edgeName(finish1, finish2)}
                />
                <StatRow
                  label="SLpM (striking output)"
                  v1={fmt(slpm1)}
                  v2={fmt(slpm2)}
                  note="Higher volume = more KO opportunities"
                  winner={edgeName(slpm1, slpm2)}
                />
                <StatRow
                  label="Avg Knockdowns / Fight"
                  v1={fmt(kd1)}
                  v2={fmt(kd2)}
                  note="Knockdown rate signals power"
                  winner={edgeName(kd1, kd2)}
                />
                <StatRow
                  label="SApM (strikes absorbed)"
                  v1={fmt(sapm1)}
                  v2={fmt(sapm2)}
                  note="Higher SApM = more hittable = KO risk"
                  winner={edgeName(sapm1, sapm2, false)}
                />
              </>
            }
            summary={
              w && w !== "Even"
                ? `${w} has the bigger KO history. Their knockdown rate supports the power narrative — watch for them to look for the finish, not the scorecards. Also note: ${edgeName(sapm1, sapm2, false) === (w === f1.name ? f2.name : f1.name) ? `${w === f1.name ? f2.name : f1.name} absorbs more strikes per minute — an elevated KO risk for them.` : "both fighters absorb similar volume."}`
                : `Both fighters have similar KO records. Look at SApM (strikes absorbed) to assess who carries more KO risk in this matchup.`
            }
          />
        );
      }

      // ── 12. Win streak / momentum ─────────────────────────────────────────
      else if (
        q.includes("win streak") ||
        q.includes("streak") ||
        q.includes("momentum") ||
        q.includes("recent performance") ||
        q.includes("age") ||
        q.includes("experience")
      ) {
        const st1 = Number(f1.current_win_streak) || 0;
        const st2 = Number(f2.current_win_streak) || 0;
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="UFC Win Streak (UFCStats)"
                  v1={f1.current_win_streak ?? "N/A"}
                  v2={f2.current_win_streak ?? "N/A"}
                  winner={st1 > st2 ? f1.name : st2 > st1 ? f2.name : null}
                />
                <StatRow
                  label="Longest UFC Win Streak (UFCStats)"
                  v1={f1.longest_win_streak ?? "N/A"}
                  v2={f2.longest_win_streak ?? "N/A"}
                  winner={null}
                />
                <StatRow
                  label="Last Fight Result"
                  v1={f1.last_fight_result ?? "N/A"}
                  v2={f2.last_fight_result ?? "N/A"}
                  winner={null}
                />
                <StatRow
                  label="UFC Record (Last 5)"
                  v1={f1.record_last_5 ?? "N/A"}
                  v2={f2.record_last_5 ?? "N/A"}
                  note="UFC fights only"
                  winner={null}
                />
                <StatRow
                  label="UFC Record (Last 10)"
                  v1={f1.record_last_10 ?? "N/A"}
                  v2={f2.record_last_10 ?? "N/A"}
                  note="UFC fights only"
                  winner={null}
                />
                <StatRow
                  label="Age"
                  v1={f1.age ?? "N/A"}
                  v2={f2.age ?? "N/A"}
                  winner={null}
                />
                <StatRow
                  label="Career Longevity (yrs)"
                  v1={f1.career_longevity_years ?? "N/A"}
                  v2={f2.career_longevity_years ?? "N/A"}
                  winner={null}
                />
              </>
            }
            summary={
              st1 > st2
                ? `${f1.name} enters on a ${st1}-fight win streak — better recent momentum. Fighters on active streaks bring sharper preparation and higher confidence heading in.`
                : st2 > st1
                  ? `${f2.name} enters on a ${st2}-fight win streak — better recent momentum. Fighters on active streaks bring sharper preparation and higher confidence heading in.`
                  : "Both fighters enter in comparable recent form. Focus on the quality of recent opponents and the methods of each win and loss."
            }
          />
        );
      }

      // ── 13. Physical / reach ──────────────────────────────────────────────
      else if (
        q.includes("reach") ||
        q.includes("physical") ||
        q.includes("height") ||
        q.includes("stance") ||
        q.includes("southpaw")
      ) {
        const parseReach = (r) => {
          if (!r || r === "N/A") return null;
          return parseFloat(String(r).replace('"', "").replace("in", ""));
        };
        const reach1 = parseReach(f1.reach),
          reach2 = parseReach(f2.reach);
        const reachDiff =
          reach1 != null && reach2 != null
            ? Math.abs(reach1 - reach2).toFixed(1)
            : null;
        const reachW =
          reach1 != null && reach2 != null
            ? reach1 > reach2
              ? f1.name
              : reach2 > reach1
                ? f2.name
                : null
            : null;
        const southpaw =
          f1.stance !== f2.stance &&
          (f1.stance === "Southpaw" || f2.stance === "Southpaw");
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="Height"
                  v1={f1.height ?? "N/A"}
                  v2={f2.height ?? "N/A"}
                  winner={null}
                />
                <StatRow
                  label="Reach"
                  v1={f1.reach ?? "N/A"}
                  v2={f2.reach ?? "N/A"}
                  note={reachDiff ? `${reachDiff}" gap` : ""}
                  winner={reachW}
                />
                <StatRow
                  label="Stance"
                  v1={f1.stance ?? "N/A"}
                  v2={f2.stance ?? "N/A"}
                  winner={null}
                />
                <StatRow
                  label="Age"
                  v1={f1.age ?? "N/A"}
                  v2={f2.age ?? "N/A"}
                  winner={null}
                />
              </>
            }
            summary={
              reachW
                ? `${reachW} has a ${reachDiff}" reach advantage — helps with jab range, kick distance, and keeping opponents at distance. Most impactful in early exchanges before a shorter fighter works inside.${southpaw ? ` Note: ${f1.stance} vs ${f2.stance} — opposite-stance matchup creates unique lead-hand alignment and diagonal cross-side angles.` : ""}`
                : `Physical attributes are close.${southpaw ? ` Note: ${f1.name} is ${f1.stance}, ${f2.name} is ${f2.stance} — stance difference creates distinct offensive angles for both fighters.` : ""}`
            }
          />
        );
      }

      // ── 14. DFS salary / value ────────────────────────────────────────────
      else if (
        q.includes("salary") ||
        q.includes("dk salary") ||
        q.includes("dfs") ||
        q.includes("value") ||
        q.includes("average points") ||
        q.includes("avg points")
      ) {
        const sal1 = num(f1.salary),
          sal2 = num(f2.salary);
        const pts1 = num(f1.avgPointsPerGame),
          pts2 = num(f2.avgPointsPerGame);
        const ppd1 = sal1 && pts1 ? (pts1 / (sal1 / 1000)).toFixed(2) : null;
        const ppd2 = sal2 && pts2 ? (pts2 / (sal2 / 1000)).toFixed(2) : null;
        const valueW = edgeName(
          ppd1 != null ? parseFloat(ppd1) : null,
          ppd2 != null ? parseFloat(ppd2) : null,
        );
        response = (
          <StatTable
            rows={
              <>
                <StatRow
                  label="DK Salary"
                  v1={sal1 != null ? `$${sal1.toLocaleString()}` : "N/A"}
                  v2={sal2 != null ? `$${sal2.toLocaleString()}` : "N/A"}
                  winner={null}
                />
                <StatRow
                  label="Avg DFS Points"
                  v1={pts1 != null ? pts1.toFixed(1) : "N/A"}
                  v2={pts2 != null ? pts2.toFixed(1) : "N/A"}
                  note="Historical scoring average"
                  winner={edgeName(pts1, pts2)}
                />
                <StatRow
                  label="Pts per $1K (value ratio)"
                  v1={ppd1 ?? "N/A"}
                  v2={ppd2 ?? "N/A"}
                  note="Higher = better DFS value"
                  winner={valueW}
                />
              </>
            }
            summary={
              valueW && valueW !== "Even"
                ? `${valueW} provides better DFS value (${valueW === f1.name ? ppd1 : ppd2} pts per $1K salary). A value play like this frees up salary cap elsewhere — key to building a winning lineup.`
                : ppd1 == null && ppd2 == null
                  ? "DFS value cannot be calculated — salary or average points data is missing for one or both fighters."
                  : "Both fighters offer similar value. Look at projected fight script (finish vs. decision) and ceiling potential when choosing between them."
            }
          />
        );
      }

      // ── 15. Overall prediction ────────────────────────────────────────────
      else if (
        q.includes("who wins") ||
        q.includes("prediction") ||
        q.includes("overall") ||
        q.includes("favorite") ||
        q.includes("fight prediction")
      ) {
        const sc = { [f1.name]: 0, [f2.name]: 0 };
        const factors = [];
        const award = (winner, reason) => {
          if (winner && winner !== "Even") {
            sc[winner]++;
            factors.push({ winner, reason });
          }
        };

        const slpm1 = num(s1.slpm),
          slpm2 = num(s2.slpm);
        const acc1 = pct(s1.striking_accuracy),
          acc2 = pct(s2.striking_accuracy);
        const sapm1 = num(s1.sapm),
          sapm2 = num(s2.sapm);
        const td1 = num(s1.td_avg),
          td2 = num(s2.td_avg);
        const tdD1 = pct(s1.td_defense),
          tdD2 = pct(s2.td_defense);
        const st1 = Number(f1.current_win_streak) || 0;
        const st2 = Number(f2.current_win_streak) || 0;
        const fin1 = pct(f1.finish_rate_pct),
          fin2 = pct(f2.finish_rate_pct);

        // Effective striking (slpm × accuracy)
        if (slpm1 != null && slpm2 != null && acc1 != null && acc2 != null) {
          const es1 = slpm1 * (acc1 / 100),
            es2 = slpm2 * (acc2 / 100);
          award(
            es1 > es2 ? f1.name : es2 > es1 ? f2.name : "Even",
            `Higher effective striking (SLpM × accuracy: ${es1.toFixed(2)} vs ${es2.toFixed(2)})`,
          );
        } else if (slpm1 != null && slpm2 != null) {
          award(edgeName(slpm1, slpm2), `Higher SLpM (${slpm1} vs ${slpm2})`);
        }

        // Striking defense (lower SApM = harder to hit)
        award(
          edgeName(sapm1, sapm2, false),
          `Absorbs fewer strikes per minute (SApM: ${sapm1 ?? "N/A"} vs ${sapm2 ?? "N/A"})`,
        );

        // Grappling effectiveness (td_avg × (1 - opponent td_defense))
        if (td1 != null && td2 != null && tdD1 != null && tdD2 != null) {
          const ws1 = td1 * (1 - tdD2 / 100),
            ws2 = td2 * (1 - tdD1 / 100);
          const wrestW = ws1 > ws2 ? f1.name : ws2 > ws1 ? f2.name : "Even";
          const [wVal, lVal] = ws1 >= ws2 ? [ws1, ws2] : [ws2, ws1];
          award(
            wrestW,
            `Better wrestling effectiveness (${wVal.toFixed(2)} vs ${lVal.toFixed(2)} adj. TDs per 15 min vs opponent's defense)`,
          );
        } else if (td1 != null && td2 != null) {
          award(
            edgeName(td1, td2),
            `Higher TD avg (${td1} vs ${td2} per 15 min)`,
          );
        }

        // Win streak momentum
        if (st1 !== st2)
          award(
            st1 > st2 ? f1.name : f2.name,
            `Longer active win streak (${Math.max(st1, st2)} fights)`,
          );

        // Finish rate
        award(
          edgeName(fin1, fin2),
          `Higher finish rate (${f1.name.split(" ").pop()}: ${fin1 ?? "N/A"}% vs ${f2.name.split(" ").pop()}: ${fin2 ?? "N/A"}%)`,
        );

        const total = sc[f1.name] + sc[f2.name];
        const predictedW =
          sc[f1.name] > sc[f2.name]
            ? f1.name
            : sc[f2.name] > sc[f1.name]
              ? f2.name
              : null;

        response = (
          <div>
            <h3 className="text-base font-bold text-stone-100 mb-3">
              {f1.name} <span className="text-stone-500">vs</span> {f2.name} —
              Overall Assessment
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[f1, f2].map((fx) => {
                const s = sc[fx.name];
                const isW = fx.name === predictedW;
                const ufcFightCount = (() => {
                  const m = (fx.record || "").match(/^(\d+)-(\d+)-(\d+)/);
                  return m
                    ? parseInt(m[1]) + parseInt(m[2]) + parseInt(m[3])
                    : null;
                })();
                const smallSample = ufcFightCount !== null && ufcFightCount < 3;
                return (
                  <div
                    key={fx.name}
                    className={`rounded-lg border p-3 ${isW ? "border-green-700/60 bg-green-950/20" : "border-stone-700 bg-stone-900"}`}
                  >
                    <div className="font-bold text-sm text-stone-100 mb-1 break-words">
                      {fx.name}
                    </div>
                    {smallSample && (
                      <div className="text-xs text-yellow-500/80 mb-1.5 leading-tight">
                        ⚠ Only {ufcFightCount} UFC fight
                        {ufcFightCount !== 1 ? "s" : ""} on record — stats are
                        based on a very small sample and may not reflect true
                        tendencies.
                      </div>
                    )}
                    <div
                      className={`text-2xl font-black ${isW ? "text-green-400" : "text-stone-500"}`}
                    >
                      {s}
                      <span className="text-sm font-normal text-stone-600">
                        /{total}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500">categories won</div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1.5 mb-4">
              {factors.map((fac, i) => (
                <p
                  key={i}
                  className="text-xs text-stone-400 flex items-start gap-1.5"
                >
                  <span
                    className={`flex-shrink-0 ${fac.winner === predictedW ? "text-green-500" : "text-stone-500"}`}
                  >
                    ●
                  </span>
                  <span>
                    <span className="text-stone-200 font-semibold">
                      {fac.winner}
                    </span>{" "}
                    — {fac.reason}
                  </span>
                </p>
              ))}
              {factors.length === 0 && (
                <p className="text-xs text-stone-500 italic">
                  Insufficient stat data for a detailed breakdown.
                </p>
              )}
            </div>
            <p className="text-sm text-stone-200 border-t border-stone-700 pt-3 leading-relaxed">
              {predictedW
                ? `Stats favor ${predictedW} across ${sc[predictedW]} of ${total} measurable categories. This is a data-driven assessment — always factor in betting lines, training camp developments, and stylistic nuances.`
                : "Stats are closely matched across all categories. Either fighter can win — lean on betting odds, stylistic matchup, and recent fight quality when making your call."}
            </p>
          </div>
        );
      }

      // ── Fallback ──────────────────────────────────────────────────────────
      else {
        response = (
          <div>
            <h3 className="text-base font-bold text-stone-100 mb-2">
              {f1.name} vs {f2.name}
            </h3>
            <p className="text-stone-400 text-sm mb-3">
              Use a quick question button or type keywords like:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "striking",
                "grappling",
                "takedown defense",
                "submission",
                "record",
                "finish rate",
                "ko",
                "win streak",
                "reach",
                "salary",
                "who wins",
              ].map((kw) => (
                <span
                  key={kw}
                  className="text-xs bg-stone-800 text-yellow-500 px-2 py-1 rounded border border-yellow-700/30"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        );
      }

      setAnswer(response);
    } catch (err) {
      console.error("[FightAnalyzer] Error generating answer:", err);
      setAnswer(
        <p className="text-red-400">
          ⚠️ Error generating answer — try again or check that fighter stats are
          loaded.
        </p>,
      );
    }
  };

  const handleQuestionButton = (q) => {
    setQuestion(q);
    // Pass `q` directly — React state updates are async, so the `question`
    // state variable would still hold the old value if we called processQuestion()
    // without an argument here.
    processQuestion(q);
  };

  if (loading)
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <p className="text-stone-500 tracking-widest animate-pulse uppercase text-sm">
          Loading Intel…
        </p>
      </div>
    );

  if (error)
    return (
      <div
        className="min-h-screen bg-stone-950 flex items-center justify-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <p className="text-red-400 text-center">{error}</p>
      </div>
    );

  return (
    <div
      className="min-h-screen bg-stone-950"
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Classification banner */}
      <div className="flex items-center justify-between border-b border-yellow-700/40 bg-yellow-900/10 px-3 sm:px-6 py-2">
        <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
          ⚡ CLASSIFIED INTEL
        </span>
        <span className="text-yellow-500/50 text-xs tracking-wider hidden sm:block">
          CLEARANCE: LEVEL 5
        </span>
        <span className="text-yellow-500 text-[11px] sm:text-xs font-bold tracking-widest uppercase">
          FIGHT ANALYSIS ⚡
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 md:py-10">
        {/* Page header */}
        <div className="text-center mb-10">
          <p className="text-xs text-stone-500 tracking-[0.5em] uppercase mb-2">
            ◆ OPERATION COMBAT VAULT — FIGHT DIVISION ◆
          </p>
          <h1
            className="text-2xl sm:text-3xl md:text-5xl font-black text-stone-100 tracking-wide uppercase"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow: "2px 2px 0 #4a5240, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            FIGHT <span className="text-yellow-600">ANALYZER</span>
          </h1>
          <p className="text-stone-400 mt-2 text-sm tracking-wide">
            {eventTitle}
          </p>
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mt-3" />
        </div>

        <select
          value={selectedFight}
          onChange={(e) => setSelectedFight(e.target.value)}
          className="border border-yellow-700/40 bg-stone-900 text-stone-100 p-2 rounded-lg w-full md:w-1/3 mb-4 min-h-[44px] text-sm"
        >
          <option value="">Select a Fight</option>
          {fights.map((fight) => (
            <option key={fight.fight_id} value={fight.fight_id}>
              {fight.fighters.map((f) => f.name).join(" vs. ")}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about striking, takedowns, or records..."
          className="border border-yellow-700/40 bg-stone-900 text-stone-100 p-2 rounded-lg w-full mb-4 min-h-[44px] text-sm"
        />

        <button
          onClick={() => processQuestion()}
          className="neon-button mb-8 w-full sm:w-auto"
        >
          Analyze
        </button>

        <div className="text-stone-300 mb-6">{answer}</div>

        {/* Live odds from cached API data */}
        {selectedFight &&
          (() => {
            const fight = fights.find(
              (f) => f.fight_id === parseInt(selectedFight),
            );
            if (!fight || fight.fighters.length < 2) return null;
            const [f1, f2] = fight.fighters;

            const lastName = (name) =>
              name.trim().split(" ").pop().toLowerCase();
            const matchEvent = cachedOdds.find((ev) => {
              const names = [ev.home_team, ev.away_team].map((n) =>
                lastName(n),
              );
              return (
                names.includes(lastName(f1.name)) ||
                names.includes(lastName(f2.name))
              );
            });

            const fmt = (p) => (p == null ? "N/A" : p > 0 ? `+${p}` : `${p}`);
            const impliedProb = (p) => {
              if (p == null) return null;
              return p < 0
                ? ((-p / (-p + 100)) * 100).toFixed(0)
                : ((100 / (p + 100)) * 100).toFixed(0);
            };
            const bestOddsFor = (bookmakers, name) => {
              let best = null;
              const last = lastName(name);
              bookmakers.forEach((bm) => {
                const h2h = bm.markets.find((m) => m.key === "h2h");
                if (!h2h) return;
                const outcome = h2h.outcomes.find(
                  (o) => lastName(o.name) === last,
                );
                if (outcome && (best === null || outcome.price > best))
                  best = outcome.price;
              });
              return best;
            };

            if (!matchEvent) {
              return (
                <div className="mb-4 px-3 py-2 bg-stone-900 border border-stone-700 rounded text-stone-500 text-xs">
                  Live odds not in cache yet — visit{" "}
                  <span className="text-yellow-500">Live Odds</span> page to
                  load them.
                </div>
              );
            }

            const o1 = bestOddsFor(matchEvent.bookmakers, f1.name);
            const o2 = bestOddsFor(matchEvent.bookmakers, f2.name);
            const f1Fav = o1 != null && o2 != null && o1 < o2;
            const f2Fav = o1 != null && o2 != null && o2 < o1;

            return (
              <div className="mb-5 border border-yellow-700/40 rounded-lg overflow-hidden bg-stone-900">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-yellow-700/20 bg-yellow-900/10">
                  <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
                    ⚡ Live Odds
                  </span>
                  <span className="text-stone-500 text-xs">
                    {matchEvent.bookmakers.length} books · best available
                  </span>
                </div>
                <div className="hidden sm:grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 gap-2">
                  <div>
                    <div className="text-stone-100 text-sm font-semibold">
                      {f1.name}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span
                        className={`text-xl font-black ${f1Fav ? "text-red-400" : "text-green-400"}`}
                      >
                        {fmt(o1)}
                      </span>
                      {o1 != null && (
                        <span className="text-stone-500 text-xs">
                          {impliedProb(o1)}%
                        </span>
                      )}
                      {f1Fav && (
                        <span className="text-xs text-red-500/70 uppercase">
                          FAV
                        </span>
                      )}
                      {!f1Fav && o1 != null && (
                        <span className="text-xs text-green-500/70 uppercase">
                          DOG
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-stone-600 text-xs font-bold text-center px-2">
                    VS
                  </div>
                  <div className="items-end flex flex-col">
                    <div className="text-stone-100 text-sm font-semibold text-right">
                      {f2.name}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      {f2Fav && (
                        <span className="text-xs text-red-500/70 uppercase">
                          FAV
                        </span>
                      )}
                      {!f2Fav && o2 != null && (
                        <span className="text-xs text-green-500/70 uppercase">
                          DOG
                        </span>
                      )}
                      {o2 != null && (
                        <span className="text-stone-500 text-xs">
                          {impliedProb(o2)}%
                        </span>
                      )}
                      <span
                        className={`text-xl font-black ${f2Fav ? "text-red-400" : "text-green-400"}`}
                      >
                        {fmt(o2)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="sm:hidden px-3 py-3 space-y-2">
                  <div className="mobile-kv-row">
                    <span className="text-sm font-semibold text-stone-100 truncate pr-2">
                      {f1.name}
                    </span>
                    <span
                      className={`text-lg font-black ${f1Fav ? "text-red-400" : "text-green-400"}`}
                    >
                      {fmt(o1)}
                    </span>
                  </div>
                  <div className="mobile-kv-row">
                    <span className="text-sm font-semibold text-stone-100 truncate pr-2">
                      {f2.name}
                    </span>
                    <span
                      className={`text-lg font-black ${f2Fav ? "text-red-400" : "text-green-400"}`}
                    >
                      {fmt(o2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

        {selectedFight &&
          (() => {
            const fight = fights.find(
              (f) => f.fight_id === parseInt(selectedFight),
            );

            const renderStats = (fighter, tabKey = activeTab) => {
              const statsList = {
                basics: [
                  { label: "Nickname", key: "nickname" },
                  { label: "Age", key: "age" },
                  { label: "Height", key: "height" },
                  { label: "Reach", key: "reach" },
                  { label: "Stance", key: "stance" },
                  { label: "Weight Class", key: "weight_class" },
                  {
                    label:
                      "Record (Full MMA career when Sherdog data available, otherwise UFC only)",
                    key: "record",
                  },
                  {
                    label: "DK (DraftKings) Salary",
                    key: "salary",
                    isMoney: true,
                  },
                  {
                    label: "Avg Points (DFS — Daily Fantasy Sports)",
                    key: "avgPointsPerGame",
                    isHighlight: true,
                  },
                ],
                striking: [
                  {
                    label: "SLpM (Sig. Strikes Landed per Min)",
                    key: "stats.slpm",
                  },
                  {
                    label: "SApM (Sig. Strikes Absorbed per Min)",
                    key: "stats.sapm",
                  },
                  {
                    label: "Striking Accuracy %",
                    key: "striking_accuracy",
                    isPct: true,
                  },
                  {
                    label: "Striking Defense %",
                    key: "stats.striking_defense",
                    isPct: true,
                  },
                ],
                strikeDistribution: [
                  {
                    label: "Head % (of landed sig strikes)",
                    key: "stats.head_str_pct",
                    isPct: true,
                  },
                  {
                    label: "Body % (of landed sig strikes)",
                    key: "stats.body_str_pct",
                    isPct: true,
                  },
                  {
                    label: "Leg % (of landed sig strikes)",
                    key: "stats.leg_str_pct",
                    isPct: true,
                  },
                  {
                    label: "Distance % (of strikes by position)",
                    key: "stats.distance_str_pct",
                    isPct: true,
                  },
                  {
                    label: "Clinch % (of strikes by position)",
                    key: "stats.clinch_str_pct",
                    isPct: true,
                  },
                  {
                    label: "Ground % (of strikes by position)",
                    key: "stats.ground_str_pct",
                    isPct: true,
                  },
                ],
                grappling: [
                  {
                    label: "TD Avg (Takedowns per 15 min)",
                    key: "stats.td_avg",
                  },
                  {
                    label: "TD Accuracy % (Takedown Accuracy)",
                    key: "stats.td_accuracy",
                    isPct: true,
                  },
                  {
                    label: "TD Defense % (Takedown Defense)",
                    key: "stats.td_defense",
                    isPct: true,
                  },
                  {
                    label: "Sub Win % (Submission Win %)",
                    key: "submission_wins_pct",
                    isPct: true,
                  },
                  { label: "Avg Sub Attempts", key: "avg_sub_attempts" },
                  {
                    label: "Avg KD (Knockdowns) / Fight",
                    key: "stats.avg_kd_per_fight",
                  },
                  {
                    label: "Avg CTRL (Control) Time (secs)",
                    key: "stats.avg_ctrl_secs",
                  },
                  {
                    label: "CTRL (Control) Time %",
                    key: "stats.grappling_control_pct",
                    isPct: true,
                  },
                ],
                // Added Defensive Grappling Breakdown using new stats from aggregate_stats.py
                defGrappling: [
                  {
                    label: "TD Defense % (Takedown Defense)",
                    key: "stats.td_defense",
                    isPct: true,
                  },
                  {
                    label: "Implied Sub Defense % (est.)",
                    key: "stats.implied_sub_def_pct",
                    isPct: true,
                  },
                  {
                    label: "Avg Opp Control Time (secs / fight)",
                    key: "stats.avg_opp_ctrl_secs",
                  },
                  {
                    label: "Reversals / Fight (bottom→top escapes)",
                    key: "stats.avg_reversals_per_fight",
                  },
                  {
                    label: "Subs Conceded (recent fights analyzed)",
                    key: "stats.subs_conceded",
                  },
                  {
                    label: "Opp Sub Attempts vs Fighter",
                    key: "stats.opp_sub_attempts_vs",
                  },
                ],
                recordAwards: [
                  {
                    label: "UFC Win Streak (UFCStats)",
                    key: "current_win_streak",
                  },
                  {
                    label: "Longest UFC Win Streak (UFCStats)",
                    key: "longest_win_streak",
                  },
                  {
                    label: "UFC Loss Streak (UFCStats)",
                    key: "current_loss_streak",
                  },
                  { label: "Last Fight Result", key: "last_fight_result" },
                  { label: "UFC Record (Last 5 fights)", key: "record_last_5" },
                  {
                    label: "UFC Record (Last 10 fights)",
                    key: "record_last_10",
                  },
                  {
                    label: "Wins by KO/TKO — pro career total",
                    key: "wins_ko_tko",
                  },
                  {
                    label: "Wins by Submission — pro career total",
                    key: "wins_submission",
                  },
                  {
                    label: "Wins by Decision — pro career total",
                    key: "wins_decision",
                  },
                  {
                    label: "Finish Rate %",
                    key: "finish_rate_pct",
                    isPct: true,
                  },
                  {
                    label: "Decision Rate %",
                    key: "decision_rate_pct",
                    isPct: true,
                  },
                  { label: "Total Title Bouts", key: "total_title_bouts" },
                ],
                advanced: [
                  { label: "UFC Ranking", key: "ufc_ranking" },
                  {
                    label: "Career Longevity (Years)",
                    key: "career_longevity_years",
                  },
                  {
                    label: "Avg Fight Duration (mins)",
                    key: "avg_fight_duration",
                  },
                  { label: "First-Round Wins", key: "first_round_wins" },
                ],
              };

              const getValue = (fighter, keyPath) => {
                const keys = keyPath.split(".");
                let value = fighter;
                for (const key of keys) {
                  value = value?.[key];
                }
                return value;
              };

              // Normalize a value that should be shown as a percentage.
              // Strips any trailing "%" already in the data, then re-adds it once.
              const formatPct = (raw) => {
                if (raw === null || raw === undefined) return "N/A";
                const stripped = String(raw).replace(/%$/, "").trim();
                if (stripped === "" || stripped === "N/A") return "N/A";
                return `${stripped}%`;
              };

              const stats = statsList[tabKey] || statsList.basics;

              // Fixed N/A spam: compute display-value for each stat so that
              // string "N/A" values coming from the data (e.g. debut fighters)
              // are treated as missing — not as real values — for the allNull check.
              const getDisplayVal = (stat) => {
                const rawVal = getValue(fighter, stat.key);
                if (stat.isMoney) return rawVal != null ? `$${rawVal}` : null;
                if (stat.isPct) {
                  const f = formatPct(rawVal);
                  return f === "N/A" ? null : f;
                }
                return rawVal != null ? rawVal : null;
              };

              // For record/award tabs, check if all values are null — show a
              // helpful message instead of a column of N/As for unmatched fighters
              const allNull = stats.every(
                (stat) => getDisplayVal(stat) === null,
              );
              if (allNull && tabKey !== "basics") {
                return (
                  <div className="text-stone-500 text-sm italic py-4 text-center">
                    No career data available for {fighter.name} in this dataset.
                    <br />
                    <span className="text-xs">
                      (Fighter not found in ufc-master.csv enrichment source)
                    </span>
                  </div>
                );
              }

              return (
                <div key={tabKey} className="space-y-2">
                  {stats.map((stat, i) => {
                    // Compute display string (reuses getDisplayVal helper above)
                    const displayVal = getDisplayVal(stat);

                    // For the Defensive Grappling tab: skip rows with no data
                    // entirely so users don't see a column of N/As for
                    // fighters whose advanced stats haven't been scraped yet.
                    if (tabKey === "defGrappling" && displayVal === null) {
                      return null;
                    }
                    // Same for strikeDistribution — only show when data exists
                    if (
                      tabKey === "strikeDistribution" &&
                      displayVal === null
                    ) {
                      return null;
                    }

                    return (
                      <div
                        key={`${tabKey}-${i}`}
                        className="flex items-baseline justify-between gap-2 py-1 border-b border-stone-700/50"
                      >
                        <span className="text-stone-500 text-sm flex-1 min-w-0">
                          {stat.label}:
                        </span>
                        {displayVal !== null ? (
                          <span
                            className={`font-semibold shrink-0 text-right ${
                              stat.isMoney || stat.isHighlight
                                ? "text-yellow-400"
                                : "text-stone-200"
                            }`}
                          >
                            {displayVal}
                          </span>
                        ) : (
                          // For non-defGrappling tabs: show muted "No data"
                          // instead of "N/A" so it's clear data is absent,
                          // not a real zero.
                          <span className="text-stone-600 text-sm italic shrink-0">
                            No data
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {tabKey === "basics" && (
                    <div className="mt-5 pt-4 border-t border-stone-700">
                      <p className="text-stone-500 text-xs font-bold mb-3 uppercase tracking-wider">
                        ◈ Highlight Reel
                      </p>
                      <p className="text-stone-500 text-xs mb-3 italic">
                        Watch key moments from this fighter's recent bouts
                      </p>
                      <div className="flex flex-col gap-4">
                        <div
                          className="relative w-full"
                          style={{ paddingBottom: "56.25%" }}
                        >
                          <iframe
                            className="absolute inset-0 w-full h-full rounded"
                            src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                            title={`${fighter.name} — Highlight Reel 1`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <div
                          className="relative w-full"
                          style={{ paddingBottom: "56.25%" }}
                        >
                          <iframe
                            className="absolute inset-0 w-full h-full rounded"
                            src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                            title={`${fighter.name} — Highlight Reel 2`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {tabKey === "recordAwards" &&
                    fighter.fight_history?.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-stone-700">
                        <p className="text-stone-500 text-xs font-bold mb-2 uppercase tracking-wider">
                          Recent Fights (Sherdog)
                        </p>
                        {fighter.fight_history.map((fh, hi) => (
                          <div
                            key={hi}
                            className="flex items-center gap-1.5 py-1.5 border-b border-stone-800 text-xs"
                          >
                            <span
                              className={`w-6 shrink-0 font-bold uppercase ${
                                fh.result === "win"
                                  ? "text-green-400"
                                  : fh.result === "loss"
                                    ? "text-red-400"
                                    : "text-stone-500"
                              }`}
                            >
                              {fh.result?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                            <span className="text-stone-300 flex-1 min-w-0 truncate">
                              {fh.opponent}
                            </span>
                            <span className="text-stone-500 shrink-0">
                              {fh.method}
                              {fh.method_detail ? ` (${fh.method_detail})` : ""}
                            </span>
                            <span className="text-stone-600 shrink-0">
                              {fh.round ? `R${fh.round}` : ""}
                            </span>
                            <span className="text-stone-600 shrink-0 hidden sm:block">
                              {fh.date}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              );
            };

            return fight && fight.fighters.length >= 2 ? (
              <div className="mb-8">
                {/* Research-First Tagline */}
                <p className="text-center text-stone-400 text-sm mb-3 italic tracking-wide">
                  📊 Research every stat side-by-side — make your own decisions
                </p>

                <details
                  open={expandedStats}
                  onToggle={(e) => setExpandedStats(e.currentTarget.open)}
                  className="border border-yellow-700/50 rounded-lg bg-stone-900"
                >
                  <summary
                    className="w-full bg-stone-900 hover:bg-stone-800 text-yellow-500 font-bold py-3 px-4 flex justify-between items-center transition"
                    aria-label="Toggle full fighter stats and comparisons"
                  >
                    <span className="text-base sm:text-xl">
                      📋 View Full Fighter Stats & Comparisons
                    </span>
                    <span className="text-lg">{expandedStats ? "▼" : "▶"}</span>
                  </summary>

                  <div className="border-t border-yellow-700/30 p-4 sm:p-6">
                    {/* Desktop tabs */}
                    <div className="hidden md:flex flex-wrap gap-2 mb-6 border-b border-gray-600 pb-4">
                      {[
                        { id: "basics", label: "Basics" },
                        { id: "striking", label: "Striking" },
                        { id: "strikeDistribution", label: "Strike Dist." },
                        { id: "grappling", label: "Grappling" },
                        { id: "defGrappling", label: "Def. Grappling" },
                        { id: "recordAwards", label: "Record & Awards" },
                        { id: "advanced", label: "Advanced / DFS" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`min-h-[42px] px-4 py-2 rounded-lg font-bold tracking-wide uppercase text-xs transition ${
                            activeTab === tab.id
                              ? "bg-yellow-700 text-stone-950"
                              : "bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Mobile: category accordions for quick scanning */}
                    <div className="md:hidden space-y-3 mb-6">
                      {[
                        { id: "basics", label: "Basics" },
                        { id: "striking", label: "Striking" },
                        {
                          id: "strikeDistribution",
                          label: "Strike Distribution",
                        },
                        { id: "grappling", label: "Grappling" },
                        { id: "defGrappling", label: "Defensive Grappling" },
                        { id: "recordAwards", label: "Record & Awards" },
                        { id: "advanced", label: "Advanced / DFS" },
                      ].map((tab) => (
                        <details
                          key={`mobile-tab-${tab.id}`}
                          className="rounded-lg border border-stone-700 bg-stone-950/70"
                        >
                          <summary
                            className="px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-yellow-500"
                            aria-label={`Toggle ${tab.label} stats`}
                          >
                            {tab.label}
                          </summary>
                          <div className="grid grid-cols-1 gap-3 p-3 border-t border-stone-700">
                            <div className="rounded border border-yellow-700/40 p-3 bg-stone-950">
                              <h4 className="text-sm font-bold text-yellow-500 mb-2 tracking-wide uppercase">
                                {fight.fighters[0].name}
                              </h4>
                              {renderStats(fight.fighters[0], tab.id)}
                            </div>
                            <div className="rounded border border-yellow-700/20 p-3 bg-stone-950">
                              <h4 className="text-sm font-bold text-yellow-400/80 mb-2 tracking-wide uppercase">
                                {fight.fighters[1].name}
                              </h4>
                              {renderStats(fight.fighters[1], tab.id)}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>

                    {/* Desktop side-by-side stats */}
                    <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="border border-yellow-700/50 rounded-lg p-4 bg-stone-950">
                        <h4 className="text-lg font-bold text-yellow-500 mb-4 text-center border-b border-yellow-700/40 pb-2 tracking-wide uppercase">
                          {fight.fighters[0].name}
                        </h4>
                        {renderStats(fight.fighters[0])}
                      </div>

                      <div className="border border-yellow-700/30 rounded-lg p-4 bg-stone-950">
                        <h4 className="text-lg font-bold text-yellow-400/80 mb-4 text-center border-b border-yellow-700/30 pb-2 tracking-wide uppercase">
                          {fight.fighters[1].name}
                        </h4>
                        {renderStats(fight.fighters[1])}
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 mt-4 italic text-center tracking-wide leading-relaxed">
                      ✓ Stats from DraftKings, UFCStats, Sherdog. Per-fight
                      rates (SLpM, SApM, TDs) = UFC bouts only. Record &amp;
                      finish counts = full pro career. Public sources only. Not
                      betting advice.
                    </p>
                  </div>
                </details>
              </div>
            ) : selectedFight ? (
              <div className="text-center text-stone-500 mb-8 tracking-wide">
                ⚠️ Select a valid fight to view comprehensive stats
              </div>
            ) : (
              <div className="text-center text-stone-500 mb-8 py-4 tracking-wide">
                👉 Select a fight above to compare fighter stats side-by-side
              </div>
            );
          })()}

        {/* ── Per-fight Matchup Intel ── */}
        {selectedFight &&
          (() => {
            const fight = fights.find(
              (f) => f.fight_id === parseInt(selectedFight),
            );
            if (!fight || fight.fighters.length < 2) return null;
            const [f1, f2] = fight.fighters;
            const directions = _computeAngles(f1, f2);
            const hasStrong = directions.some((d) =>
              d.angles.some((a) => a.level === "strong"),
            );
            const hasModerate = directions.some((d) =>
              d.angles.some((a) => a.level === "moderate"),
            );
            const cardBorder = hasStrong
              ? "border-red-700/60"
              : hasModerate
                ? "border-orange-700/50"
                : "border-stone-700/60";

            return (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-yellow-700/30" />
                  <span className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
                    ◈ MATCHUP INTEL
                  </span>
                  <div className="h-px flex-1 bg-yellow-700/30" />
                </div>
                <p className="text-stone-400 text-center text-xs mb-4">
                  Directional exploit analysis.{" "}
                  <span className="text-red-400">🔴 Exploit</span> = clear edge
                  over opponent's weakness ·{" "}
                  <span className="text-orange-400">🟠 Edge</span> = some
                  advantage · <span className="text-stone-400">⚪ Even</span> =
                  no clear edge.
                </p>
                <div
                  className={`bg-stone-900 rounded-lg border ${cardBorder} p-4`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-stone-100 font-bold text-sm">
                      {f1.name}
                      <span className="text-stone-500 mx-2">vs</span>
                      {f2.name}
                    </span>
                    {hasStrong && (
                      <span className="text-xs bg-red-800 text-red-100 px-2 py-0.5 rounded font-bold">
                        ⚠ Exploit Found
                      </span>
                    )}
                  </div>

                  {directions.map((dir, di) => {
                    const topAngles = dir.angles.filter(
                      (a) => a.level !== "neutral",
                    );
                    if (topAngles.length === 0) return null;
                    return (
                      <div key={di} className="mb-3">
                        <p className="text-xs text-stone-400 mb-1 font-semibold">
                          {dir.attacker}{" "}
                          <span className="text-stone-600">exploiting</span>{" "}
                          {dir.defender}
                        </p>
                        <div className="flex flex-col gap-1">
                          {dir.angles.map((angle, ai) => {
                            const style = _LEVEL[angle.level];
                            return (
                              <div
                                key={ai}
                                className={`flex items-center gap-2 rounded px-2 py-1 ${style.bg} border ${style.border}`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`}
                                />
                                <span className="text-xs text-stone-300 flex-1">
                                  <span className="font-semibold text-stone-100">
                                    {angle.label}
                                  </span>
                                  {" — "}
                                  {angle.tip}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${style.badge}`}
                                >
                                  {style.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {(() => {
                    const allStrong = directions.flatMap((d) =>
                      d.angles
                        .filter((a) => a.level === "strong")
                        .map((a) => `${d.attacker}'s ${a.label.toLowerCase()}`),
                    );
                    if (allStrong.length === 0) return null;
                    return (
                      <p className="text-xs text-yellow-400/80 mt-2 border-t border-stone-700 pt-2">
                        💡 DFS angle: Target {allStrong.join(" and ")}.
                      </p>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-yellow-700/30" />
          <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
            ◈ QUICK QUESTION BUTTONS
          </h2>
          <div className="h-px flex-1 bg-yellow-700/30" />
        </div>

        <div className="md:hidden pb-6">
          <details className="rounded-lg border border-stone-700 bg-stone-900/80">
            <summary className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-yellow-500">
              Show Quick Questions
            </summary>
            <div className="grid grid-cols-1 gap-3 p-3 border-t border-stone-700">
              {generalQuestions.map((question, index) => (
                <button
                  key={`mobile-q-${index}`}
                  onClick={() => handleQuestionButton(question)}
                  className="bg-stone-900 border border-yellow-700/40 text-stone-300 text-xs font-bold tracking-wide py-3 px-4 rounded-lg hover:bg-stone-800 hover:border-yellow-600/60 hover:text-yellow-400 transition duration-200 text-left min-h-[44px]"
                >
                  {question}
                </button>
              ))}
            </div>
          </details>
        </div>

        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 pb-10">
          {generalQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleQuestionButton(question)}
              className="bg-stone-900 border border-yellow-700/40 text-stone-300 text-xs font-bold tracking-wide py-3 px-4 rounded-lg hover:bg-stone-800 hover:border-yellow-600/60 hover:text-yellow-400 transition duration-200 text-left"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FightAnalyzer;
