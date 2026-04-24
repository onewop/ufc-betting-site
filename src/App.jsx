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
import PredictionTrackRecord from "./components/PredictionTrackRecord";
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
  { to: "/fight-analyzer", label: "Fight Analyzer" },
  { to: "/odds", label: "Live Odds" },
  { to: "/predictions", label: "Predictions & Projections" },
  { to: "/parlay-builder", label: "Parlay Builder" },
  { to: "/value-bets", label: "+EV Value Bets" },
  { to: "/track-record", label: "AI Track Record" },
];

const mobileNavLinks = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/fight-analyzer", label: "Analyze", icon: "📊" },
  { to: "/odds", label: "Odds", icon: "💰" },
  { to: "/team-combinations", label: "DFS", icon: "🏆" },
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
        className="sticky top-0 z-50 bg-stone-950 border-b border-yellow-700/40 shadow-[0_2px_24px_rgba(0,0,0,0.7)]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-7xl mx-auto px-4">
          {/* ── Main bar ── */}
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <Link
              to="/"
              className="flex items-center gap-2 shrink-0 group"
              aria-label="Combat Vault home"
            >
              <span className="text-yellow-500 text-[11px] font-black tracking-[0.35em] uppercase group-hover:text-yellow-400 transition-colors">
                ⚡ COMBAT VAULT
              </span>
            </Link>

            {/* Desktop links — lg+ (1024px) */}
            <ul className="hidden lg:flex items-center gap-0.5">
              {navLinks.map(({ to, label }) => {
                const isActive =
                  to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(to);
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      className={`relative px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all rounded-lg whitespace-nowrap ${
                        isActive
                          ? "text-yellow-400 bg-yellow-900/25"
                          : "text-stone-400 hover:text-stone-100 hover:bg-stone-800/70"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-yellow-500 rounded-full" />
                      )}
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Desktop auth / user controls */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setTheme((prev) => (prev === "dark" ? "light" : "dark"))
                }
                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition text-sm"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>

              {currentUser && !checkIsPro(currentUser) && (
                <button
                  onClick={handleUpgrade}
                  className="text-[11px] font-bold uppercase tracking-wide text-green-400 border border-green-600/40 px-3 py-1.5 rounded-lg hover:bg-green-900/30 transition"
                >
                  ⬆ Pro
                </button>
              )}

              {currentUser ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-stone-800 transition"
                  >
                    <span className="w-7 h-7 rounded-full bg-yellow-900/70 text-yellow-400 text-xs font-black border border-yellow-700/50 flex items-center justify-center">
                      {(currentUser.username || currentUser.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                    <span className="text-stone-400 text-xs hidden xl:block max-w-[120px] truncate">
                      {currentUser.username || currentUser.email}
                    </span>
                    <span className="text-stone-600 text-[10px]">▾</span>
                  </button>
                  {dropdownOpen && (
                    <div
                      ref={dropdownRef}
                      className="absolute top-full right-0 mt-2 bg-stone-900 border border-stone-700/80 rounded-xl shadow-2xl p-1.5 min-w-[160px] z-50"
                    >
                      {checkIsPro(currentUser) && (
                        <div className="px-3 py-1.5 mb-1 border-b border-stone-800">
                          <span className="text-[10px] uppercase tracking-widest text-yellow-600 font-bold">
                            ⚡ Pro Member
                          </span>
                        </div>
                      )}
                      <Link
                        to="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg transition"
                      >
                        Dashboard
                      </Link>
                      <button
                        onClick={() => {
                          handleLogout();
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-stone-800 rounded-lg transition mt-0.5"
                      >
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openAuth("login")}
                    className="text-[11px] font-bold uppercase tracking-wide text-stone-400 hover:text-stone-100 px-3 py-1.5 rounded-lg hover:bg-stone-800 transition"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => openAuth("register")}
                    className="text-[11px] font-bold uppercase tracking-wide text-stone-950 bg-yellow-500 hover:bg-yellow-400 px-3 py-1.5 rounded-lg transition shadow-lg"
                  >
                    Register
                  </button>
                </div>
              )}
            </div>

            {/* Mobile: theme + avatar + hamburger */}
            <div className="flex lg:hidden items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setTheme((prev) => (prev === "dark" ? "light" : "dark"))
                }
                className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition text-sm"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>
              {currentUser && (
                <span className="w-7 h-7 rounded-full bg-yellow-900/70 text-yellow-400 text-xs font-black border border-yellow-700/50 flex items-center justify-center">
                  {(currentUser.username || currentUser.email || "?")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
              <button
                className="w-10 h-10 flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-stone-800 transition focus:outline-none"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
              >
                <span
                  className={`block h-0.5 w-5 bg-stone-300 transition-all duration-200 origin-center ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`}
                />
                <span
                  className={`block h-0.5 w-5 bg-stone-300 transition-all duration-200 ${menuOpen ? "opacity-0 scale-x-0" : ""}`}
                />
                <span
                  className={`block h-0.5 w-5 bg-stone-300 transition-all duration-200 origin-center ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile drawer ── */}
        {menuOpen && (
          <div className="lg:hidden border-t border-yellow-900/30 bg-stone-950/98 backdrop-blur-sm">
            {/* User identity row */}
            {currentUser && (
              <div className="px-5 py-3.5 border-b border-stone-800/80 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-yellow-900/70 text-yellow-400 text-sm font-black border border-yellow-700/50 flex items-center justify-center shrink-0">
                  {(currentUser.username || currentUser.email || "?")
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-yellow-400 text-sm font-bold truncate">
                    {currentUser.username || currentUser.email}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-stone-600">
                    {checkIsPro(currentUser) ? "⚡ Pro Member" : "Free Tier"}
                  </p>
                </div>
              </div>
            )}

            {/* Nav links */}
            <div className="py-2">
              {navLinks.map(({ to, label }) => {
                const isActive =
                  to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all border-l-2 ${
                      isActive
                        ? "text-yellow-400 bg-yellow-900/15 border-yellow-500"
                        : "text-stone-400 hover:text-stone-100 hover:bg-stone-900/60 border-transparent"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
              {currentUser && (
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center px-5 py-3 text-sm font-bold uppercase tracking-wide transition-all border-l-2 ${
                    location.pathname === "/dashboard"
                      ? "text-yellow-400 bg-yellow-900/15 border-yellow-500"
                      : "text-yellow-600 hover:text-yellow-400 hover:bg-stone-900/60 border-transparent"
                  }`}
                >
                  Dashboard
                </Link>
              )}
            </div>

            {/* Bottom actions */}
            <div className="px-4 pb-4 pt-2 border-t border-stone-800/80 flex flex-col gap-2">
              {currentUser && !checkIsPro(currentUser) && (
                <button
                  onClick={() => {
                    handleUpgrade();
                    setMenuOpen(false);
                  }}
                  className="w-full py-2.5 text-xs font-bold uppercase tracking-wide text-green-400 border border-green-600/40 rounded-xl hover:bg-green-900/25 transition"
                >
                  ⬆ Upgrade to Pro — $19.99/mo
                </button>
              )}
              {currentUser ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="w-full py-2.5 text-xs font-bold uppercase tracking-wide text-red-400 border border-red-700/30 rounded-xl hover:bg-red-900/20 transition"
                >
                  Log Out
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      openAuth("login");
                      setMenuOpen(false);
                    }}
                    className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wide text-stone-300 border border-stone-700 rounded-xl hover:bg-stone-800 transition"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => {
                      openAuth("register");
                      setMenuOpen(false);
                    }}
                    className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wide text-stone-950 bg-yellow-500 hover:bg-yellow-400 rounded-xl transition shadow-lg"
                  >
                    Register
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
        <Route
          path="/odds"
          element={<LatestOdds currentUser={currentUser} />}
        />
        <Route
          path="/predictions"
          element={
            <DFSPicksProjections
              eventTitle={eventTitle}
              currentUser={currentUser}
            />
          }
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
          element={
            <ValueBets eventTitle={eventTitle} currentUser={currentUser} />
          }
        />
        <Route path="/track-record" element={<PredictionTrackRecord />} />
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
