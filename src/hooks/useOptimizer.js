/**
 * useOptimizer.js — Custom React hook for DFS lineup optimizer state & logic.
 *
 * Responsibilities:
 *   - Fetches fighter data from the backend API on mount
 *   - Manages all optimizer state (fighters, limits, generated teams, errors)
 *   - Exposes generateTeams(), downloadCSV(), saveLineups() actions
 *   - Handles Stripe upgrade redirect for non-Pro users
 *
 * Used by: TeamCombinations.jsx (main page container)
 * Depends on: ../utils/optimizerHelpers.js for pure helper functions
 */

import { useState, useEffect } from "react";
import { comb, buildDraftKingsCSV } from "../utils/optimizerHelpers";
import api from "../services/api";

export default function useOptimizer() {
  const [fighters, setFighters] = useState([]);
  const [randomTeams, setRandomTeams] = useState([]);
  const [fighterCounts, setFighterCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numTeams, setNumTeams] = useState(5);
  const [fighterLimits, setFighterLimits] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [generatedCount, setGeneratedCount] = useState(0);
  const [stackWarnings, setStackWarnings] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [useSalaryTarget, setUseSalaryTarget] = useState(false);
  const [salaryMode, setSalaryMode] = useState("diverse");
  const [saveStatus, setSaveStatus] = useState(null);

  const numFights = [...new Set(fighters.map((f) => f.fight_id))].length;
  const totalPossibleTeams = 2n ** BigInt(numFights) * comb(numFights, 6);

  const filteredFighters = fighters.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ── Fetch fighters on mount ────────────────────────────────────────────
  useEffect(() => {
    api
      .get("/api/fighters")
      .then((data) => {
        const realFighters = data.fighters;
        setFighters(realFighters);
        const initialLimits = {};
        realFighters.forEach((f) => {
          initialLimits[f.id] = { min: 0, max: Infinity };
        });
        setFighterLimits(initialLimits);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          `Failed to load fighter data: ${err.message}. Is the optimizer server running? Start it with: uvicorn backend.main:app --reload --port 8000`,
        );
        setLoading(false);
        console.error("Error loading fighters:", err);
      });
  }, []);

  // ── Fighter limit changes ──────────────────────────────────────────────
  const handleLimitChange = (fighterId, type, value) => {
    const parsedValue = parseInt(value);
    setFighterLimits((prev) => ({
      ...prev,
      [fighterId]: {
        ...prev[fighterId],
        [type]: isNaN(parsedValue)
          ? type === "min"
            ? 0
            : Infinity
          : parsedValue,
      },
    }));
  };

  // ── Generate teams via backend optimizer ────────────────────────────────
  const generateTeams = async () => {
    setError(null);
    setRandomTeams([]);
    setFighterCounts({});
    setGenerating(true);

    try {
      if (numFights < 6) {
        setError(
          "Not enough fights on the card to build teams (need at least 6).",
        );
        return;
      }

      const excludedIds = Object.entries(fighterLimits)
        .filter(([, { max }]) => max === 0)
        .map(([id]) => String(id));
      const lockedIds = Object.entries(fighterLimits)
        .filter(([, { min }]) => min >= numTeams)
        .map(([id]) => String(id));

      // Build per-fighter exposure overrides for partial min/max ranges.
      // Skips fighters that are fully locked or fully excluded (handled above).
      const fighterOverrides = {};
      Object.entries(fighterLimits).forEach(([id, { min, max }]) => {
        if (max === 0) return; // fully excluded
        if (min >= numTeams) return; // fully locked
        const hasMin = typeof min === "number" && isFinite(min) && min > 0;
        const hasMax =
          typeof max === "number" && isFinite(max) && max < numTeams;
        if (hasMin || hasMax) {
          const override = {};
          if (hasMin) override.min_exposure = min / numTeams;
          if (hasMax) override.max_exposure = max / numTeams;
          fighterOverrides[String(id)] = override;
        }
      });

      const data = await api.post("/api/optimize", {
        num_lineups: numTeams,
        salary_mode: salaryMode,
        locked_fighters: lockedIds,
        excluded_fighters: excludedIds,
        exposure_limit: 1.0,
        fighter_overrides: fighterOverrides,
      });

      const rawLineups = Array.isArray(data.lineups)
        ? data.lineups
        : Array.isArray(data)
          ? data
          : [];
      const selectedTeams = rawLineups
        .map((l) => (Array.isArray(l.fighters) ? l.fighters : l))
        .filter((team) => Array.isArray(team));

      if (selectedTeams.length === 0) {
        setError(
          "No valid teams could be generated. Try removing exclusions or reducing the number of teams.",
        );
        return;
      }

      const finalCounts = {};
      fighters.forEach((f) => {
        finalCounts[f.id] = { name: f.name, count: 0 };
      });
      selectedTeams.forEach((team) =>
        team.forEach((f) => {
          if (finalCounts[f.id]) finalCounts[f.id].count++;
          else finalCounts[f.id] = { name: f.name, count: 1 };
        }),
      );

      if (selectedTeams.length < numTeams) {
        setError(
          `Only ${selectedTeams.length} unique teams could be generated.`,
        );
      }

      setRandomTeams(selectedTeams);
      setFighterCounts(finalCounts);
      setGeneratedCount(selectedTeams.length);
      setStackWarnings([]);
    } catch (err) {
      setError(
        `Failed to generate lineups: ${err.message}. Is the optimizer server running? Start it with: uvicorn backend.main:app --reload --port 8000`,
      );
    } finally {
      setGenerating(false);
    }
  };

  // ── Download lineups as DraftKings CSV ──────────────────────────────────
  const downloadCSV = () => {
    const result = buildDraftKingsCSV(randomTeams, fighters);
    if (!result) {
      alert("No valid lineups to export.");
      return;
    }
    const { blob, filename, skipped } = result;
    if (skipped.length > 0) {
      alert(
        `Warning — ${skipped.length} lineup(s) skipped:\n\n${skipped.join("\n")}`,
      );
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Save lineups to backend ─────────────────────────────────────────────
  const saveLineups = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("You must be logged in to save lineups.");
      return;
    }
    if (randomTeams.length === 0) return;

    const defaultName = `My Lineup Set – ${new Date().toLocaleDateString()}`;
    const name = window.prompt(
      "Enter a name for this lineup set:",
      defaultName,
    );
    if (!name) return;

    setSaveStatus("saving");
    const avgSalary = Math.round(
      randomTeams.reduce(
        (s, team) => s + team.reduce((sum, f) => sum + f.salary, 0),
        0,
      ) / randomTeams.length,
    );
    const avgFpts = parseFloat(
      (
        randomTeams.reduce(
          (s, team) => s + team.reduce((sum, f) => sum + (f.avgFPPG || 0), 0),
          0,
        ) / randomTeams.length
      ).toFixed(2),
    );

    try {
      await api.post(
        "/api/lineups",
        {
          name,
          lineup_data: randomTeams,
          total_salary: avgSalary,
          projected_fpts: avgFpts,
          salary_mode: salaryMode,
        },
        token,
      );
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(null);
      setError(`Failed to save lineup: ${err.message}`);
    }
  };

  // ── Stripe upgrade redirect ─────────────────────────────────────────────
  const handleUpgrade = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    try {
      const data = await api.post("/api/create-checkout-session", {}, token);
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade error:", err);
    }
  };

  return {
    // State
    fighters,
    filteredFighters,
    randomTeams,
    fighterCounts,
    loading,
    error,
    numTeams,
    fighterLimits,
    searchTerm,
    generatedCount,
    stackWarnings,
    generating,
    useSalaryTarget,
    salaryMode,
    saveStatus,
    numFights,
    totalPossibleTeams,
    // Setters
    setNumTeams,
    setSearchTerm,
    setUseSalaryTarget,
    setSalaryMode,
    // Actions
    handleLimitChange,
    generateTeams,
    downloadCSV,
    saveLineups,
    handleUpgrade,
  };
}
