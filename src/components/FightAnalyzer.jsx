import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import "tailwindcss/tailwind.css"; // or your correct Tailwind import path
import WeighInClips from "./WeighInClips";
import KeyNotes from "./KeyNotes";
import FullFightRecord from "./FullFightRecord";
import { motion, AnimatePresence } from "framer-motion";
import { predictFight, CONFIDENCE_LEVELS } from "./fightAnalyzerHelpers";
import api from "../services/api";
import FightStatsSection from "./FightStatsSection";
import MatchupIntel from "./MatchupIntel";
import FighterImage from "./FighterImage";

const FightAnalyzer = ({
  eventTitle = "Latest UFC Event",
  currentUser = null,
}) => {
  const [fighters, setFighters] = useState([]);
  const [fights, setFights] = useState([]);
  const [highlightVideos, setHighlightVideos] = useState({});
  const [selectedFight, setSelectedFight] = useState("");
  const [fightDropdownOpen, setFightDropdownOpen] = useState(false);
  const fightDropdownRef = useRef(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [cachedOdds, setCachedOdds] = useState([]);
  const [activeTab, setActiveTab] = useState("basics");
  const [fightResults, setFightResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState(null);
  const [resultsSort, setResultsSort] = useState({
    key: "EVENT",
    order: "desc",
  });
  const [analysis, setAnalysis] = useState(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedFighterForRecord, setSelectedFighterForRecord] =
    useState(null);
  const scrollContentRef = useRef(null);
  const statsRef = useRef(null);

  const openRecordModal = useCallback((fighter) => {
    setSelectedFighterForRecord(fighter);
    setShowRecordModal(true);
  }, []);

  const closeRecordModal = useCallback(() => {
    setShowRecordModal(false);
  }, []);

  const openFullStats = useCallback((fight) => {
    setSelectedFight(String(fight.fight_id));
    setQuestion("Who wins? Overall fight prediction.");
    setActiveTab("basics");
    setTimeout(() => {
      statsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, []);

  const openHighlights = useCallback((fight) => {
    setSelectedFight(String(fight.fight_id));
    setActiveTab("basics");
    setTimeout(() => {
      statsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, []);

  // Reset scroll to top after AnimatePresence has mounted the DOM node
  useEffect(() => {
    if (!showRecordModal) return;
    const id = setTimeout(() => {
      if (scrollContentRef.current) scrollContentRef.current.scrollTop = 0;
    }, 50);
    return () => clearTimeout(id);
  }, [showRecordModal, selectedFighterForRecord]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && showRecordModal) closeRecordModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showRecordModal, closeRecordModal]);

  useEffect(() => {
    if (showRecordModal) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      window.scrollTo(0, parseInt(scrollY || "0") * -1);
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
    };
  }, [showRecordModal]);

  // Single shared fight lookup — stable reference, prevents redundant .find() in each render block
  const selectedFightData = useMemo(() => {
    if (!selectedFight) return null;
    return fights.find((f) => f.fight_id === parseInt(selectedFight)) || null;
  }, [selectedFight, fights]);

  useEffect(() => {
    setError(null);

    // Load highlight videos from JSON first, then hydrate fighters
    const loadData = async () => {
      let videos = {};
      let weighInVideos = {};
      try {
        const hvRes = await fetch("/highlight_videos.json");
        if (hvRes.ok) {
          const hvData = await hvRes.json();
          // Remove the _instructions key, keep only fighter→videoId mappings
          const { _instructions, ...fighterVideos } = hvData;
          // Build a lowercase-keyed lookup for case-insensitive matching
          Object.entries(fighterVideos).forEach(([name, id]) => {
            videos[name.toLowerCase()] = id;
          });
          setHighlightVideos(videos);
        }
      } catch (_) {}

      try {
        const wvRes = await fetch("/weigh_in_videos.json");
        if (wvRes.ok) {
          const wvData = await wvRes.json();
          const { _instructions: _wi, ...wiFighters } = wvData;
          Object.entries(wiFighters).forEach(([name, id]) => {
            weighInVideos[name.toLowerCase()] = id;
          });
        }
      } catch (_) {}

      try {
        const data = await api.get("/api/this-weeks-stats");
        const rawFights = data.fights || [];

        // Add fight_id to each fight and map fighter data
        const processedFights = rawFights.map((fight, index) => ({
          fight_id: index,
          matchup: fight.matchup,
          weight_class: fight.weight_class,
          fighters: (fight.fighters || []).map((f) => {
            // Prefer local JSON lookup; fall back to backend-embedded value
            const videoId =
              videos[f.name?.toLowerCase()] || f.highlightVideoId || null;
            const weighInId =
              weighInVideos[f.name?.toLowerCase()] || f.weighInVideoId || null;
            return {
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
              // Highlight video fields for FighterHighlights component
              highlightVideoId: videoId,
              youtubeHighlightUrl: videoId
                ? `https://www.youtube.com/watch?v=${videoId}`
                : null,
              // Weigh-in video for WeighInClips component
              weighInVideoId: weighInId,
            };
          }),
        }));

        setFights(processedFights);

        const allFighters = processedFights.flatMap(
          (fight) => fight.fighters || [],
        );
        setFighters(allFighters);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load fighters:", err.message);
        setError("Failed to load fighters: " + err.message);
        setLoading(false);
      }
    };

    loadData();

    // Load fight results via backend API (avoids Vercel SPA catch-all swallowing the raw CSV)
    api
      .get("/api/last-event-results")
      .then((data) => {
        setFightResults(data.fights || []);
        setResultsLoading(false);
      })
      .catch((err) => {
        console.log("Fight results fetch failed:", err.message);
        setResultsError("Could not load last event data.");
        setResultsLoading(false);
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

  const generateAnalysis = useCallback((results) => {
    if (!results || results.length === 0) return;
    const upsets = [];
    const valueFighters = [];
    results.forEach((result) => {
      const boutParts = result.BOUT?.split(" vs. ") || ["", ""];
      const winner = result.OUTCOME === "W/L" ? boutParts[0] : boutParts[1];
      const loser = result.OUTCOME === "W/L" ? boutParts[1] : boutParts[0];
      if (result.METHOD === "KO/TKO" && result.ROUND === "1") {
        upsets.push({
          winner,
          loser,
          method: result.METHOD,
          round: result.ROUND,
          time: result.TIME,
        });
      }
      if (result.METHOD === "KO/TKO" || result.METHOD === "Submission") {
        valueFighters.push({
          name: winner,
          method: result.METHOD,
          round: result.ROUND,
          time: result.TIME,
          weightclass: result.WEIGHTCLASS,
        });
      }
    });
    const methods = results.reduce((acc, r) => {
      const m = r.METHOD || "Unknown";
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});
    const finishes = results.filter(
      (r) =>
        r.METHOD !== "Decision - Unanimous" &&
        r.METHOD !== "Decision - Split" &&
        r.METHOD !== "Decision - Majority",
    );
    setAnalysis({
      eventName: results[0]?.EVENT || "",
      totalFights: results.length,
      upsets,
      valueFighters,
      cardAnalysis: {
        finishRate: ((finishes.length / results.length) * 100).toFixed(0),
        avgRound: (
          results.reduce((sum, r) => sum + (parseInt(r.ROUND) || 0), 0) /
          results.length
        ).toFixed(1),
        methodBreakdown: methods,
        koCount: results.filter((r) => r.METHOD === "KO/TKO").length,
        subCount: results.filter((r) => r.METHOD === "Submission").length,
      },
    });
  }, []);

  useEffect(() => {
    if (fightResults.length > 0) generateAnalysis(fightResults);
  }, [fightResults, generateAnalysis]);

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
            <p className="text-stone-400 text-sm mb-3">Type keywords like:</p>
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

        {/* Custom fight dropdown — replaces native <select> to fix invisible options on Android WebView */}
        {/* ── Fight Card Grid ── */}
        <div className="grid grid-cols-1 gap-5 mb-10">
          {fights.map((fight, idx) => {
            if (fight.fighters.length < 2) return null;
            const [f1, f2] = fight.fighters;
            const pred = predictFight(f1, f2);
            const isSelected = parseInt(selectedFight) === fight.fight_id;

            return (
              <div
                key={fight.fight_id}
                className={`bg-stone-900 border rounded-2xl overflow-hidden transition-all duration-300 ${
                  isSelected
                    ? "border-yellow-600 shadow-[0_0_24px_rgba(202,138,4,0.2)]"
                    : "border-stone-700 hover:border-yellow-700/60 hover:shadow-xl"
                }`}
              >
                {/* Card header */}
                <div className="bg-stone-950 px-5 py-3 border-b border-stone-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-stone-500">
                      FIGHT #{idx + 1}
                    </span>
                    {fight.weight_class && (
                      <span className="px-2.5 py-0.5 text-[11px] font-mono bg-stone-800 text-yellow-500 rounded-full border border-yellow-700/30">
                        {fight.weight_class}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-[11px] font-mono text-yellow-500 tracking-widest uppercase">
                      ◆ SELECTED
                    </span>
                  )}
                </div>

                <div className="p-5 sm:p-6">
                  {/* Fighters side by side */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-6">
                    {/* Fighter 1 */}
                    <div className="flex flex-col items-center text-center">
                      <FighterImage
                        name={f1.name}
                        size="w-20 h-20 sm:w-28 sm:h-28"
                        className="rounded-xl border-2 border-red-700/60 shadow-lg"
                      />
                      <h3 className="mt-3 text-sm sm:text-lg font-black text-white tracking-tight leading-tight">
                        {f1.name}
                      </h3>
                      {f1.record && (
                        <p className="text-stone-500 text-[11px] mt-0.5">
                          {f1.record}
                        </p>
                      )}
                      {/* Win prob bar */}
                      <div className="w-full mt-3">
                        <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-700 to-red-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${pred.winner.name === f1.name ? pred.winner.winProb : pred.loser.winProb}%`,
                            }}
                          />
                        </div>
                        <p className="text-[11px] font-mono mt-1 text-red-400">
                          {pred.winner.name === f1.name
                            ? pred.winner.winProb
                            : pred.loser.winProb}
                          % WIN
                        </p>
                      </div>
                    </div>

                    {/* VS */}
                    <div className="flex flex-col items-center justify-center pt-6 sm:pt-8">
                      <span className="text-3xl sm:text-5xl font-black text-stone-700/70 tracking-tighter select-none">
                        VS
                      </span>
                    </div>

                    {/* Fighter 2 */}
                    <div className="flex flex-col items-center text-center">
                      <FighterImage
                        name={f2.name}
                        size="w-20 h-20 sm:w-28 sm:h-28"
                        className="rounded-xl border-2 border-emerald-700/60 shadow-lg"
                      />
                      <h3 className="mt-3 text-sm sm:text-lg font-black text-white tracking-tight leading-tight">
                        {f2.name}
                      </h3>
                      {f2.record && (
                        <p className="text-stone-500 text-[11px] mt-0.5">
                          {f2.record}
                        </p>
                      )}
                      {/* Win prob bar */}
                      <div className="w-full mt-3">
                        <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                            style={{
                              width: `${pred.winner.name === f2.name ? pred.winner.winProb : pred.loser.winProb}%`,
                            }}
                          />
                        </div>
                        <p className="text-[11px] font-mono mt-1 text-emerald-400">
                          {pred.winner.name === f2.name
                            ? pred.winner.winProb
                            : pred.loser.winProb}
                          % WIN
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Prediction confidence badge */}
                  <div className="mt-4 flex justify-center">
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold tracking-widest uppercase ${CONFIDENCE_LEVELS[pred.confidence].badge}`}
                    >
                      {pred.winner.name.split(" ").pop()} favored —{" "}
                      {CONFIDENCE_LEVELS[pred.confidence].label}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-5 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => openHighlights(fight)}
                      className="flex-1 flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-stone-600 px-4 py-2.5 rounded-xl text-xs font-mono tracking-wider text-stone-300 transition-all active:scale-95"
                    >
                      🎬 WATCH HIGHLIGHTS
                    </button>
                    <button
                      onClick={() => openFullStats(fight)}
                      className="flex-1 flex items-center justify-center gap-2 bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-700/50 hover:border-yellow-600 px-4 py-2.5 rounded-xl text-xs font-mono tracking-wider text-yellow-400 transition-all active:scale-95"
                    >
                      📋 VIEW FULL INTEL
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Anchor for scroll-to-stats */}
        <div ref={statsRef} />

        <div className="text-stone-300 mb-6">{answer}</div>

        {/* Live odds from cached API data */}
        {selectedFightData &&
          (() => {
            const fight = selectedFightData;
            if (fight.fighters.length < 2) return null;
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

        {selectedFightData ? (
          <FightStatsSection
            fight={selectedFightData}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            openRecordModal={openRecordModal}
          />
        ) : selectedFight ? (
          <div className="text-center text-stone-500 mb-8 tracking-wide">
            ⚠️ Select a valid fight to view comprehensive stats
          </div>
        ) : null}

        {/* ── Per-fight Fight Prediction ── */}
        {selectedFightData &&
          (() => {
            const fight = selectedFightData;
            if (fight.fighters.length < 2) return null;
            const [f1, f2] = fight.fighters;
            const pred = predictFight(f1, f2);
            const style = CONFIDENCE_LEVELS[pred.confidence];
            const wBreak = pred.categories[pred.winner.name];
            const lBreak = pred.categories[pred.loser.name];

            return (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-yellow-700/30" />
                  <span className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
                    ◈ FIGHT PREDICTION
                  </span>
                  <div className="h-px flex-1 bg-yellow-700/30" />
                </div>
                <p className="text-stone-400 text-center text-xs mb-4">
                  Comprehensive 10-category analysis using all available stats,
                  records, physical attributes & fight history.
                </p>

                <div
                  className={`bg-stone-900 rounded-lg border ${style.border} p-4 ${style.glow}`}
                >
                  {/* Winner header */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`}
                      />
                      <div className="min-w-0">
                        <div className="text-stone-100 font-bold text-sm truncate">
                          {pred.winner.name}
                        </div>
                        <div className="text-stone-500 text-xs truncate">
                          vs {pred.loser.name}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-wider flex-shrink-0 ${style.badge}`}
                    >
                      {style.label}
                    </span>
                  </div>

                  {/* Win probability bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1 gap-2">
                      <span className="font-bold text-stone-100 truncate min-w-0 flex-1">
                        {pred.winner.name}
                        <span className="text-stone-400 font-normal ml-1.5">
                          {pred.winner.winProb}%
                        </span>
                      </span>
                      <span className="text-stone-400 truncate min-w-0 flex-1 text-right">
                        {pred.loser.name}
                        <span className="ml-1.5">{pred.loser.winProb}%</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-stone-800 rounded-full overflow-hidden flex">
                      <div
                        className={`${style.barColor} rounded-l-full transition-all`}
                        style={{ width: `${pred.winner.winProb}%` }}
                      />
                      <div className="bg-stone-600 flex-1 rounded-r-full" />
                    </div>
                  </div>

                  {/* Narrative */}
                  <p className="text-xs text-stone-300 leading-relaxed mb-3 border-t border-stone-700/50 pt-3">
                    {pred.narrative}
                  </p>

                  {/* Category breakdown */}
                  <div className="border-t border-stone-700/50 pt-3">
                    {/* Full fighter name column headers */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-[11px] font-bold text-emerald-400 flex-1 truncate"
                        title={pred.winner.name}
                      >
                        {pred.winner.name}
                      </span>
                      <span className="text-[9px] text-stone-600 uppercase tracking-widest flex-shrink-0 w-6 text-center">
                        vs
                      </span>
                      <span
                        className="text-[11px] font-semibold text-stone-300 flex-1 truncate text-right"
                        title={pred.loser.name}
                      >
                        {pred.loser.name}
                      </span>
                    </div>

                    {/* Category rows — label above bar */}
                    <div className="space-y-3">
                      {Object.entries(pred.catLabels).map(([key, label]) => {
                        const wScore = wBreak[key]?.score ?? 50;
                        const lScore = lBreak[key]?.score ?? 50;
                        const isWinnerCat = pred.catWins.winner.includes(key);
                        const isLoserCat = pred.catWins.loser.includes(key);
                        const total = wScore + lScore || 100;
                        return (
                          <div key={key}>
                            <div className="text-[9px] text-stone-500 uppercase tracking-widest font-bold mb-1">
                              {label}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-mono font-bold w-8 text-right flex-shrink-0 ${isWinnerCat ? "text-emerald-400" : "text-stone-500"}`}
                              >
                                {wScore}
                              </span>
                              <div className="h-2 flex-1 bg-stone-800 rounded-full overflow-hidden flex">
                                <div
                                  className={`rounded-l-full transition-all ${isWinnerCat ? "bg-emerald-500" : isLoserCat ? "bg-stone-600" : "bg-stone-500"}`}
                                  style={{
                                    width: `${(wScore / total) * 100}%`,
                                  }}
                                />
                                <div
                                  className={`rounded-r-full flex-1 ${isLoserCat ? "bg-red-500/60" : "bg-stone-700"}`}
                                />
                              </div>
                              <span
                                className={`text-[11px] font-mono font-bold w-8 flex-shrink-0 ${isLoserCat ? "text-red-400" : "text-stone-500"}`}
                              >
                                {lScore}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Category wins summary — pill cards */}
                    <div className="flex items-stretch gap-2 mt-4 pt-3 border-t border-stone-700/30">
                      <div className="flex-1 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2 flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl font-black text-emerald-400 flex-shrink-0 leading-none">
                          {pred.catWins.winner.length}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[9px] text-stone-500 uppercase tracking-widest leading-none mb-0.5">
                            categories
                          </div>
                          <div
                            className="text-[11px] font-bold text-emerald-400 truncate"
                            title={pred.winner.name}
                          >
                            {pred.winner.name}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 bg-stone-800/50 border border-stone-700/50 rounded-lg px-3 py-2 flex items-center gap-2.5 min-w-0 flex-row-reverse">
                        <span className="text-2xl font-black text-stone-300 flex-shrink-0 leading-none">
                          {pred.catWins.loser.length}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[9px] text-stone-500 uppercase tracking-widest leading-none mb-0.5 text-right">
                            categories
                          </div>
                          <div
                            className="text-[11px] font-semibold text-stone-300 truncate text-right"
                            title={pred.loser.name}
                          >
                            {pred.loser.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Last Event Results Section — always visible */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-yellow-700/30" />
            <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
              ◈ LAST EVENT RESULTS
            </h2>
            <div className="h-px flex-1 bg-yellow-700/30" />
          </div>

          <details
            open
            className="group/events border border-yellow-700/50 rounded-lg bg-stone-900"
          >
            <summary
              className="w-full bg-stone-900 hover:bg-stone-800 text-yellow-500 font-bold py-3 px-4 flex justify-between items-center transition cursor-pointer"
              aria-label="Toggle last event results"
            >
              <span className="text-base sm:text-xl">
                📊 Stats from Last Week's Fights{" "}
                {fightResults.length > 0
                  ? `(${fightResults[0]?.EVENT?.trim()})`
                  : resultsLoading
                    ? ""
                    : ""}
              </span>
              <span className="text-lg group-open/events:hidden">▶</span>
              <span className="text-lg hidden group-open/events:inline">▼</span>
            </summary>

            <div className="border-t border-yellow-700/30 p-4 sm:p-6">
              {resultsLoading && (
                <p className="text-stone-500 text-sm text-center py-4 italic animate-pulse">
                  Loading last event results…
                </p>
              )}
              {!resultsLoading && resultsError && (
                <p className="text-stone-500 text-sm text-center py-4 italic">
                  No previous event data available.
                </p>
              )}
              {!resultsLoading &&
                !resultsError &&
                fightResults.length === 0 && (
                  <p className="text-stone-500 text-sm text-center py-4 italic">
                    No previous event data available.
                  </p>
                )}
              {/* Fight Night Stats */}
              {analysis && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {[
                      {
                        label: "Total Fights",
                        value: analysis.totalFights,
                        color: "text-yellow-400",
                      },
                      {
                        label: "KO / TKO",
                        value: analysis.cardAnalysis.koCount,
                        color: "text-red-400",
                      },
                      {
                        label: "Submissions",
                        value: analysis.cardAnalysis.subCount,
                        color: "text-blue-400",
                      },
                      {
                        label: "Finish Rate",
                        value: `${analysis.cardAnalysis.finishRate}%`,
                        color: "text-green-400",
                      },
                    ].map(({ label, value, color }) => (
                      <div
                        key={label}
                        className="bg-stone-800/60 border border-yellow-700/20 rounded-xl p-4 text-center"
                      >
                        <div className={`text-2xl font-black ${color}`}>
                          {value}
                        </div>
                        <div className="text-stone-500 text-[10px] uppercase tracking-widest mt-1">
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
                    {/* Biggest Upsets */}
                    <div className="bg-stone-800/50 border border-red-900/40 rounded-xl p-4">
                      <h2 className="text-xs font-bold tracking-[0.3em] uppercase text-red-400 mb-3">
                        💥 Biggest Upsets
                      </h2>
                      {analysis.upsets.length > 0 ? (
                        <div className="space-y-2">
                          {analysis.upsets.map((u, i) => (
                            <div
                              key={i}
                              className="bg-stone-900/60 rounded-lg p-3 border border-red-900/30"
                            >
                              <div className="font-bold text-white text-sm">
                                {u.winner}
                              </div>
                              <div className="text-stone-400 text-xs">
                                def. {u.loser}
                              </div>
                              <div className="text-red-400 text-xs mt-1">
                                {u.method} · R{u.round} · {u.time}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-stone-500 text-sm">
                          No first-round finishes this card
                        </p>
                      )}
                    </div>

                    {/* Best Value Fighters */}
                    <div className="bg-stone-800/50 border border-green-900/40 rounded-xl p-4">
                      <h2 className="text-xs font-bold tracking-[0.3em] uppercase text-green-400 mb-3">
                        💎 Best Value Fighters
                      </h2>
                      {analysis.valueFighters.length > 0 ? (
                        <div className="space-y-2">
                          {analysis.valueFighters.slice(0, 5).map((f, i) => (
                            <div
                              key={i}
                              className="bg-stone-900/60 rounded-lg p-3 border border-green-900/30"
                            >
                              <div className="font-bold text-white text-sm">
                                {f.name}
                              </div>
                              <div className="text-stone-400 text-xs">
                                {f.weightclass}
                              </div>
                              <div className="text-green-400 text-xs mt-1">
                                {f.method} · R{f.round} · {f.time}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-stone-500 text-sm">
                          No finishes recorded
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Method Breakdown + Key Insights */}
                  {analysis.cardAnalysis.methodBreakdown && (
                    <div className="mb-6 grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 mb-2">
                          Finish Methods
                        </h3>
                        <div className="space-y-1">
                          {Object.entries(
                            analysis.cardAnalysis.methodBreakdown,
                          ).map(([method, count]) => (
                            <div
                              key={method}
                              className="flex justify-between text-xs"
                            >
                              <span className="text-stone-400 truncate pr-2">
                                {method}
                              </span>
                              <span className="font-bold text-white">
                                {count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 mb-2">
                          Key Insights
                        </h3>
                        <div className="space-y-1 text-xs text-stone-300">
                          <p>
                            • {analysis.cardAnalysis.finishRate}% finish rate
                          </p>
                          <p>
                            • Avg fight: {analysis.cardAnalysis.avgRound} rounds
                          </p>
                          <p>
                            • {analysis.totalFights} total bouts on the card
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm font-mono">
                  <thead>
                    <tr className="border-b border-stone-700">
                      <th className="text-left py-2 px-2 text-yellow-500 font-bold">
                        Bout
                      </th>
                      <th className="text-left py-2 px-2 text-yellow-500 font-bold">
                        Outcome
                      </th>
                      <th className="text-left py-2 px-2 text-yellow-500 font-bold">
                        Method
                      </th>
                      <th
                        className="text-left py-2 px-2 text-yellow-500 font-bold cursor-pointer hover:text-yellow-400"
                        onClick={() =>
                          setResultsSort({
                            key: "ROUND",
                            order:
                              resultsSort.key === "ROUND" &&
                              resultsSort.order === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Round{" "}
                        {resultsSort.key === "ROUND" &&
                          (resultsSort.order === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="text-left py-2 px-2 text-yellow-500 font-bold cursor-pointer hover:text-yellow-400"
                        onClick={() =>
                          setResultsSort({
                            key: "TIME",
                            order:
                              resultsSort.key === "TIME" &&
                              resultsSort.order === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Time{" "}
                        {resultsSort.key === "TIME" &&
                          (resultsSort.order === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-left py-2 px-2 text-yellow-500 font-bold">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fightResults
                      .sort((a, b) => {
                        const aVal = a[resultsSort.key] || "";
                        const bVal = b[resultsSort.key] || "";
                        const order = resultsSort.order === "asc" ? 1 : -1;
                        if (resultsSort.key === "ROUND") {
                          return (parseInt(aVal) || 0) > (parseInt(bVal) || 0)
                            ? order
                            : -order;
                        }
                        return aVal.localeCompare(bVal) * order;
                      })
                      .map((result, index) => {
                        const boutParts = result.BOUT?.split(" vs. ") || [
                          "",
                          "",
                        ];
                        const outcome = result.OUTCOME || "";
                        const eventShort =
                          result.EVENT?.replace(
                            "UFC Fight Night: ",
                            "",
                          ).replace("UFC ", "") || "N/A";

                        // Determine winner/loser colors based on OUTCOME
                        let fighter1Color = "text-stone-100";
                        let fighter2Color = "text-stone-100";
                        let outcomeText = "";

                        if (outcome === "W/L") {
                          fighter1Color = "text-green-400 font-semibold";
                          fighter2Color = "text-red-400";
                          outcomeText = `${boutParts[0]} def. ${boutParts[1]}`;
                        } else if (outcome === "L/W") {
                          fighter1Color = "text-red-400";
                          fighter2Color = "text-green-400 font-semibold";
                          outcomeText = `${boutParts[1]} def. ${boutParts[0]}`;
                        } else if (outcome === "D/D") {
                          fighter1Color = "text-stone-400";
                          fighter2Color = "text-stone-400";
                          outcomeText = "Draw";
                        }

                        return (
                          <tr
                            key={index}
                            className="border-b border-stone-800 hover:bg-stone-800/30"
                          >
                            <td className="py-2 px-2 text-stone-200">
                              <span className={fighter1Color}>
                                {boutParts[0]}
                              </span>
                              <span className="text-stone-500 mx-1">vs</span>
                              <span className={fighter2Color}>
                                {boutParts[1]}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-stone-300 text-sm">
                              {outcomeText}
                            </td>
                            <td className="py-2 px-2 text-stone-300">
                              {result.METHOD || "N/A"}
                            </td>
                            <td className="py-2 px-2 text-stone-300">
                              {result.ROUND || "N/A"}
                            </td>
                            <td className="py-2 px-2 text-stone-300">
                              {result.TIME || "N/A"}
                            </td>
                            <td
                              className="py-2 px-2 text-stone-300 text-sm max-w-[200px] truncate"
                              title={result.DETAILS}
                            >
                              {result.DETAILS || "N/A"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <p className="text-stone-500 text-xs mt-4 text-center">
                Data sourced from UFCStats.com — showing fights from the most
                recent UFC event only
              </p>
            </div>
          </details>
        </div>
      </div>

      {/* === FULL FIGHT RECORD MODAL — POLISHED === */}
      <AnimatePresence mode="wait">
        {showRecordModal && selectedFighterForRecord && (
          <motion.div
            key="record-modal-backdrop"
            ref={scrollContentRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[9999] overflow-y-auto"
            style={{
              backgroundColor: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(6px)",
            }}
            onClick={closeRecordModal}
          >
            {/* Centering wrapper — min-h-full so short content stays centered */}
            <div className="flex min-h-full items-start justify-center p-4 sm:p-6 sm:items-center">
              <motion.div
                key="record-modal-content"
                initial={{ scale: 0.9, opacity: 0, y: 28 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.93, opacity: 0, y: 16 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="relative bg-stone-900 rounded-3xl w-full max-w-4xl my-4"
                style={{
                  boxShadow:
                    "0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header — sticky so it stays visible while scrolling */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-stone-700/60 bg-stone-950/95 rounded-t-3xl">
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-[0.35em] mb-0.5">
                      Professional Record
                    </p>
                    <h2 className="text-xl sm:text-2xl font-black text-stone-100 tracking-wide">
                      {selectedFighterForRecord.name}
                    </h2>
                  </div>
                  <button
                    onClick={closeRecordModal}
                    aria-label="Close modal"
                    className="w-9 h-9 ml-4 flex-shrink-0 flex items-center justify-center rounded-full bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-white text-xl leading-none transition-all duration-150 hover:scale-110"
                  >
                    ×
                  </button>
                </div>

                {/* Content — no scroll container needed; backdrop scrolls */}
                <div className="px-5 py-6 sm:px-8 sm:py-7">
                  <FullFightRecord fighter={selectedFighterForRecord} />
                </div>

                {/* Footer hint */}
                <div className="sticky bottom-0 z-10 px-6 py-3 border-t border-stone-800/60 bg-stone-950/95 rounded-b-3xl text-center">
                  <span className="text-[11px] text-stone-600">
                    Press{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-mono text-[10px] border border-stone-700">
                      Esc
                    </kbd>{" "}
                    or click outside to close
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FightAnalyzer;
