import React, { useState, useEffect, useRef } from "react";
import { isPro as checkIsPro, isDevUser } from "./utils/devAccess";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import Home from "./components/Home";
import TeamCombinations from "./components/TeamCombinations";
import FightAnalyzer from "./components/FightAnalyzer";
import VideoVault from "./creator/VideoVault";
import SmartAIPicks from "./components/SmartAIPicks";
import DFSPicksProjections from "./components/DFSPicksProjections";
import VideosV2 from "./creator/VideosV2";
import LatestOdds from "./components/LatestOdds";
import VideoStudio from "./creator/VideoStudio";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import MySavedLineups from "./components/MySavedLineups";
import UserDashboard from "./components/UserDashboard";
import ParlayBuilder from "./components/ParlayBuilder";
import ValueBets from "./components/ValueBets";
// PRIVATE OWNER TOOL — not linked in any public navigation
import DebugStatsPage from "./pages/DebugStatsPage";
import ManagerPage from "./pages/ManagerPage";
import api from "./services/api";

// Auth keys for localStorage
const AUTH_TOKEN_KEY = "authToken";
const AUTH_USER_KEY = "currentUser";

// Updated navLinks with event context for current card
const navLinks = [
  { to: "/", label: "Home" },
  {
    to: "/team-combinations",
    label: "Fantasy Teams",
  },
  { to: "/smart-picks", label: "Smart AI Picks" },
  { to: "/fight-analyzer", label: "Fight Analyzer - Latest Card" },
  { to: "/odds", label: "Live Odds" },
  { to: "/predictions", label: "Predictions & Projections" },
  { to: "/parlay-builder", label: "Parlay Builder" },
  { to: "/value-bets", label: "+EV Value Bets" },
];

const mobileNavLinks = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/fight-analyzer", label: "Analyze", icon: "◈" },
  { to: "/odds", label: "Odds", icon: "$" },
  { to: "/predictions", label: "DFS", icon: "▦" },
  { to: "/parlay-builder", label: "Parlay", icon: "🎯" },
];

const AppShell = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("Latest UFC Event");
  const [theme, setTheme] = useState("dark");
  const [authToken, setAuthToken] = useState(
    localStorage.getItem(AUTH_TOKEN_KEY) || "",
  );
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState("login");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetch("/current_event.json")
      .then((res) => res.json())
      .then((data) => setEventTitle(data.title || "Latest UFC Event"))
      .catch(() => setEventTitle("Latest UFC Event"));
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const storedTheme = localStorage.getItem("combat_vault_theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("combat_vault_theme", theme);
  }, [theme]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");

    if (sessionId && authToken) {
      console.log(
        "🔄 Detected return from Stripe checkout. Re-fetching user status...",
      );

      // Show success banner immediately (assuming successful payment)
      setShowUpgradeSuccess(true);
      setTimeout(() => setShowUpgradeSuccess(false), 6000);

      // Clean URL immediately
      window.history.replaceState({}, document.title, window.location.pathname);

      // Retry fetching /auth/me up to 3 times with 1.5s delay
      let attempts = 0;
      const maxAttempts = 3;
      const retryDelay = 1500; // ms

      const fetchUntilPro = async () => {
        attempts++;
        console.log(`🔄 Fetch attempt ${attempts}/${maxAttempts}`);
        try {
          const user = await api.get("/auth/me", authToken);
          console.log(
            `📋 /auth/me returned subscription_status: ${user.subscription_status}`,
          );

          localStorage.setItem(AUTH_TOKEN_KEY, authToken);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
          setCurrentUser(user);

          return; // Success, stop retries
        } catch (err) {
          console.error("Error fetching /auth/me:", err);
        }

        if (attempts < maxAttempts) {
          console.log(
            `⏳ Status still not pro, retrying in ${retryDelay}ms...`,
          );
          setTimeout(fetchUntilPro, retryDelay);
        } else {
          console.warn(
            "⚠️ Max retries reached. Status may update on next login.",
          );
        }
      };

      fetchUntilPro();
    }
  }, [authToken]);

  const handleLoginSuccess = async (token) => {
    try {
      const user = await api.get("/auth/me", token);
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      setAuthToken(token);
      setCurrentUser(user);
      console.log("✅ Full user loaded from /auth/me:", user);

      if (user.subscription_status === "pro" || isDevUser(user.email)) {
        setShowUpgradeSuccess(true);
        setTimeout(() => setShowUpgradeSuccess(false), 6000);
        console.log("🎉 User is now Pro!");
      }
    } catch (error) {
      console.error("Error fetching /auth/me:", error.message);
    }
  };

  const handleLogout = () => {
    setAuthToken("");
    setCurrentUser(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  };

  const openAuth = (tab) => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const handleUpgrade = async () => {
    if (!authToken) {
      openAuth("login");
      return;
    }
    try {
      const data = await api.post(
        "/api/create-checkout-session",
        {},
        authToken,
      );
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade error:", err);
      alert("Could not start checkout. Please try again or contact support.");
    }
  };

  // Listen for PaywallGate (and other components) requesting the auth modal
  useEffect(() => {
    const handler = (e) => openAuth(e.detail?.tab || "login");
    window.addEventListener("cagevault:openAuthModal", handler);
    return () => window.removeEventListener("cagevault:openAuthModal", handler);
  }, []); // eslint-disable-line

  return (
    <div
      className={`min-h-screen nav-safe-bottom xl:pb-0 ${theme === "light" ? "theme-light bg-stone-100 text-stone-900" : "bg-gray-900"}`}
    >
      <nav
        className="sticky top-0 z-50 text-stone-100 shadow-lg border-b border-yellow-900/60"
        style={{
          backgroundColor: "#92400e",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-2 xl:py-3 flex items-center justify-between xl:justify-center flex-col">
          {/* Desktop nav links — visible only at xl (1280px+) */}
          <ul className="hidden xl:flex flex-wrap justify-center gap-x-5 gap-y-1">
            {navLinks.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="text-sm hover:underline whitespace-nowrap"
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() =>
                  setTheme((prev) => (prev === "dark" ? "light" : "dark"))
                }
                className="border border-yellow-200/40 rounded px-2 py-1 text-xs uppercase tracking-wider hover:bg-yellow-900/30 transition"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? "Light" : "Dark"}
              </button>
            </li>
            {currentUser && !checkIsPro(currentUser) && (
              <li>
                <button
                  onClick={handleUpgrade}
                  className="border border-green-500/40 rounded px-2 py-1 text-xs uppercase tracking-wider hover:bg-green-900/30 transition text-green-400"
                >
                  Upgrade Pro
                </button>
              </li>
            )}
            {currentUser ? (
              <>
                <li>
                  <Link
                    to="/dashboard"
                    className="text-sm hover:underline whitespace-nowrap"
                  >
                    Dashboard
                  </Link>
                </li>
                <li className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="text-sm hover:underline whitespace-nowrap flex items-center gap-1"
                  >
                    {currentUser.username || currentUser.email} ▼
                  </button>
                  {dropdownOpen && (
                    <div
                      ref={dropdownRef}
                      className="absolute top-full right-0 mt-1 bg-stone-800 border border-stone-600 rounded p-2 z-50"
                    >
                      <button
                        onClick={handleLogout}
                        className="text-xs text-stone-300 hover:text-white"
                      >
                        Log Out
                      </button>
                    </div>
                  )}
                </li>
              </>
            ) : (
              <>
                <li>
                  <button
                    onClick={() => openAuth("login")}
                    className="text-sm hover:underline whitespace-nowrap"
                  >
                    Log In
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openAuth("register")}
                    className="text-sm hover:underline whitespace-nowrap"
                  >
                    Register
                  </button>
                </li>
              </>
            )}
          </ul>

          {/* Hamburger row — visible below xl (< 1280px) */}
          <div className="w-full flex items-center justify-between xl:hidden">
            <span className="font-bold tracking-wide text-sm sm:text-base truncate pr-2">
              {eventTitle} - Combat Vault
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setTheme((prev) => (prev === "dark" ? "light" : "dark"))
                }
                className="min-h-[40px] px-2 border border-yellow-200/40 rounded text-xs uppercase tracking-wider"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>
              {currentUser && !menuOpen && (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-900/70 text-yellow-400 text-xs font-bold border border-yellow-700/50">
                  {(currentUser.username || currentUser.email || "?")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
              <button
                className="flex flex-col gap-1.5 p-2 focus:outline-none min-h-[44px] min-w-[44px] items-center justify-center"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                <span
                  className={`block h-0.5 w-6 bg-stone-100 transition-transform duration-200 ${menuOpen ? "translate-y-2 rotate-45" : ""}`}
                />
                <span
                  className={`block h-0.5 w-6 bg-stone-100 transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`}
                />
                <span
                  className={`block h-0.5 w-6 bg-stone-100 transition-transform duration-200 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Hamburger dropdown */}
          {menuOpen && (
            <ul className="xl:hidden flex flex-col border-t border-yellow-900/60 w-full bg-stone-900">
              {currentUser && (
                <li className="px-6 py-3 border-b border-yellow-900/40 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-900/50 text-yellow-400 text-xs font-bold">
                    {(currentUser.username || currentUser.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className="text-yellow-400 text-sm font-medium truncate">
                    {currentUser.username || currentUser.email}
                  </span>
                  {checkIsPro(currentUser) && (
                    <span className="text-[10px] uppercase tracking-widest bg-yellow-600/30 text-yellow-400 px-1.5 py-0.5 rounded font-bold">
                      Pro
                    </span>
                  )}
                </li>
              )}
              {navLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="block px-6 py-3 hover:bg-yellow-900/40 transition"
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                  </Link>
                </li>
              ))}
              {currentUser && (
                <li>
                  <Link
                    to="/dashboard"
                    className="block px-6 py-3 hover:bg-yellow-900/40 transition text-yellow-400"
                    onClick={() => setMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                </li>
              )}
              {currentUser && !checkIsPro(currentUser) && (
                <li>
                  <button
                    onClick={() => {
                      handleUpgrade();
                      setMenuOpen(false);
                    }}
                    className="block w-full text-left px-6 py-3 hover:bg-green-900/40 transition text-green-400"
                  >
                    Upgrade to Pro
                  </button>
                </li>
              )}
              {/* Auth buttons — always shown at bottom of mobile menu */}
              {currentUser ? (
                <li>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMenuOpen(false);
                    }}
                    className="block w-full text-left px-6 py-3 hover:bg-red-900/40 transition text-red-400 border-t border-yellow-900/40"
                  >
                    Log Out
                  </button>
                </li>
              ) : (
                <>
                  <li className="border-t border-yellow-900/40">
                    <button
                      onClick={() => {
                        openAuth("login");
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-6 py-3 hover:bg-yellow-900/40 transition text-yellow-400 font-medium"
                    >
                      Log In
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        openAuth("register");
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-6 py-3 hover:bg-yellow-900/40 transition text-yellow-300"
                    >
                      Register
                    </button>
                  </li>
                </>
              )}
            </ul>
          )}
        </div>
      </nav>
      <div className="bg-gray-800 text-yellow-400 text-center py-2 sm:py-3 font-semibold text-sm sm:text-xl border-b border-yellow-900/60 px-3">
        {eventTitle}
      </div>

      {showUpgradeSuccess && (
        <div className="bg-green-600 text-white text-center py-3 px-4 border-b border-green-700">
          ✅ Welcome to Combat Vault Pro! You now have full access.
        </div>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/team-combinations"
          element={
            <TeamCombinations
              eventTitle={eventTitle}
              currentUser={currentUser}
            />
          }
        />
        <Route
          path="/smart-picks"
          element={<SmartAIPicks currentUser={currentUser} />}
        />
        <Route
          path="/fight-analyzer"
          element={
            <FightAnalyzer eventTitle={eventTitle} currentUser={currentUser} />
          }
        />
        <Route path="/odds" element={<LatestOdds />} />
        <Route
          path="/predictions"
          element={<DFSPicksProjections eventTitle={eventTitle} currentUser={currentUser} />}
        />
        <Route path="/my-lineups" element={<MySavedLineups />} />
        <Route
          path="/dashboard"
          element={<UserDashboard currentUser={currentUser} />}
        />
        <Route
          path="/parlay-builder"
          element={<ParlayBuilder currentUser={currentUser} />}
        />
        <Route
          path="/value-bets"
          element={<ValueBets eventTitle={eventTitle} currentUser={currentUser} />}
        />
        {/* PRIVATE OWNER TOOL — /debug-stats — not in nav, not linked publicly */}
        <Route
          path="/debug-stats"
          element={
            currentUser ? (
              <DebugStatsPage currentUser={currentUser} />
            ) : (
              <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <p className="text-stone-400 text-sm">
                  🔒 Debug tools require login.
                </p>
              </div>
            )
          }
        />
        {/* PRIVATE — Manager/Admin dashboard at /manager */}
        <Route
          path="/manager"
          element={<ManagerPage currentUser={currentUser} />}
        />
      </Routes>
      <Footer />

      <nav
        className={`xl:hidden fixed bottom-0 left-0 right-0 z-[60] border-t border-yellow-900/60 touch-none ${theme === "light" ? "bg-amber-100" : "bg-stone-950"}`}
        style={{ paddingBottom: "var(--sab)" }}
        aria-label="Mobile quick navigation"
      >
        <ul className="flex flex-row w-full">
          {mobileNavLinks.map(({ to, label, icon }) => {
            const active =
              to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to);
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  // transition-colors only — never animate layout/size on mount
                  className={`flex min-h-[44px] flex-row items-center justify-center gap-1 px-0.5 text-[9px] tracking-wide transition-colors duration-150 ${
                    active
                      ? "text-yellow-400 bg-yellow-900/20"
                      : theme === "light"
                        ? "text-stone-600 hover:text-amber-700"
                        : "text-stone-400 hover:text-yellow-500"
                  }`}
                  aria-label={label}
                >
                  <span className="text-sm leading-none">{icon}</span>
                  <span className="leading-tight">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authModalTab}
        onLoginSuccess={handleLoginSuccess}
        onRegisterSuccess={handleLoginSuccess}
      />
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <AppShell />
    </Router>
  );
};

export default App;
