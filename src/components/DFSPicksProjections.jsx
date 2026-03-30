import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useLocalStorage } from "use-local-storage";
import { useTheme } from "next-themes";
import { useMediaQuery } from "react-responsive";

import { FighterImage } from "@/components/FighterImage";
import { TeamCombinations } from "@/components/TeamCombinations";
import { DisasterPicks } from "@/components/DisasterPicks";
import { LatestOdds } from "@/components/LatestOdds";
import { VideoStudio } from "@/components/VideoStudio";
import { VideoVault } from "@/components/VideoVault";
import { FightAnalyzer } from "@/components/FightAnalyzer";
import { ManualTeams } from "@/components/ManualTeams";

import { parseRoundsLine, avgRoundsFromDuration, avgRoundsFromStyle, estimateFightRounds, computeProjection, estimateOwnership, buildReasoning, parsePct, evalAngle, evalSubAngle, computeMatchupAngles, rowClass, sortPicks, getCombinations, buildAllValidLineups, runOptimizer, handleSort } from "@/utils/dfs";

const DFSPicksProjections = ({ eventTitle = "" }) => {
  const [picks, setPicks] = useState([]);
  const [fights, setFights] = useState([]);
  const [eventName, setEventName] = useState("This Week's Card");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("projMid");
  const [sortOrder, setSortOrder] = useState("desc");
  const [locked, setLocked] = useState(new Set());
  const [excluded, setExcluded] = useState(new Set());
  const [openSections, setOpenSections] = useState({});
  const [focusedFightId, setFocusedFightId] = useState(null);
  const [optimizerError, setOptimizerError] = useState(null);
  const [optimalLineups, setOptimalLineups] = useState([]);
  const [userSeed, setUserSeed] = useState(123456789);

  useEffect(() => {
    // Fetch data from API
    fetch("/api/dfs-picks")
      .then((res) => res.json())
      .then((data) => {
        setPicks(data.picks);
        setFights(data.fights);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load DFS picks data");
        setLoading(false);
      });
  }, []);

  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const openAndScroll = (id, key) => {
    if (key) setOpenSections((prev) => ({ ...prev, [key]: true }));
    setTimeout(
      () =>
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const openMatchupIntelFight = (fightAnchor, e) => {
    if (e) e.preventDefault();
    const match = String(fightAnchor).match(/^fight-(.+)$/);
    setFocusedFightId(match ? match[1] : null);
    openAndScroll(fightAnchor, "matchupIntel");
  };

  const toggleLock = (name) => {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        setExcluded((ex) => {
          const e = new Set(ex);
          e.delete(name);
          return e;
        });
      }
      return next;
    });
  };

  const toggleExclude = (name) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        setLocked((lk) => {
          const l = new Set(lk);
          l.delete(name);
          return l;
        });
      }
      return next;
    });
  };

  const getCombinations = (arr, k) => {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    return [
      ...getCombinations(rest, k - 1).map((c) => [first, ...c]),
      ...getCombinations(rest, k),
    ];
  };

  const buildAllValidLineups = (allPicks, lockedSet, excludedSet) => {
    const available = allPicks.filter((p) => !excludedSet.has(p.fighter));
    const byFight = {};
    available.forEach((p) => {
      if (!byFight[p.fightId]) byFight[p.fightId] = [];
      byFight[p.fightId].push(p);
    });
    const lockedFighters = [];
    lockedSet.forEach((name) => {
      const fighter = allPicks.find((p) => p.fighter === name);
      if (fighter) lockedFighters.push(fighter);
    });
    const allLineups = [];
    const fightsWithFighters = Object.values(byFight).filter(
      (fighters) => fighters.length > 0,
    );
    const fightIds = fightsWithFighters.map((f) => f[0].fightId);
    const allFighters = available.map((p) => p.fighter);
    const allFighterNames = [...new Set(allFighters)];
    const allFighterNamesSorted = allFighterNames.sort();
    const allFighterNamesSortedWithLocks = allFighterNamesSorted.filter(
      (name) => lockedSet.has(name),
    );
    const allFighterNamesSortedWithoutLocks = allFighterNamesSorted.filter(
      (name) => !lockedSet.has(name),
    );
    const allFighterNamesSortedWithLocksAndExcluded = allFighterNamesSortedWithLocks.filter(
      (name) => !excludedSet.has(name),
    );
    const allFighterNamesSortedWithoutLocksAndExcluded = allFighterNamesSortedWithoutLocks.filter(
      (name) => !excludedSet.has(name),
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIds = allFighterNamesSortedWithLocksAndExcluded.filter(
      (name) => fightIds.includes(fighter.fightId),
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIds = allFighterNamesSortedWithoutLocksAndExcluded.filter(
      (name) => fightIds.includes(fighter.fightId),
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFighters = allFighterNamesSortedWithLocksAndExcludedAndFightIds.map(
      (name) => {
        const fighter = allPicks.find((p) => p.fighter === name);
        return fighter;
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFighters = allFighterNamesSortedWithoutLocksAndExcludedAndFightIds.map(
      (name) => {
        const fighter = allPicks.find((p) => p.fighter === name);
        return fighter;
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFighters = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIds.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFighters = allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIds.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters = allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters = allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters = allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds = allFighterNamesSortedWithoutLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fightId,
        };
      },
    );
    const allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFighters = allFighterNamesSortedWithLocksAndExcludedAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIdsAndFightersAndFightIds.map(
      (fighter) => {
        return {
          ...fighter,
          fightId: fighter.fight身
