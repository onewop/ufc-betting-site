import React, { useState, useEffect, useRef } from "react";
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
import VideoVault from "./components/VideoVault";
import ManualTeams from "./components/ManualTeams";
import DFSPicksProjections from "./components/DFSPicksProjections";
import VideosV2 from "./components/VideosV2";
import LatestOdds from "./components/LatestOdds";
import VideoStudio from "./components/VideoStudio";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import MySavedLineups from "./components/MySavedLineups";
import UserDashboard from "./components/UserDashboard";

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
  { to: "/manual-teams", label: "Manual Teams" },
  { to: "/fight-analyzer", label: "Fight Analyzer - Latest Card" },
  { to: "/odds", label: "Live Odds" },
  { to: "/predictions", label: "Predictions & Projections" },
  { to: "/video-studio", label: "Creator Studio" },
];

const currentEvent = "UFC Fight Night: Evloev vs. Murphy — March 21, 2026";

const mobileNavLinks = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/fight-analyzer", label: "Analyze", icon: "◈" },
  { to: "/odds", label: "Odds", icon: "$" },
  { to: "/predictions", label: "DFS", icon: "▦" },
  { to: "/team-combinations", label: "Teams", icon: "☰" },
];

const AppShell = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("Latest UFC Event");
  const [theme, setTheme] = useState("dark");
  const [compactBottomNav, setCompactBottomNav] = useState(false);
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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 359px)");
    const applyCompact = () => setCompactBottomNav(mediaQuery.matches);
    applyCompact();
    mediaQuery.addEventListener("change", applyCompact);
    return () => mediaQuery.removeEventListener("change", applyCompact);
  }, []);

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
          const response = await fetch("http://localhost:8000/auth/me", {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (response.ok) {
            const user = await response.json();
            console.log(
              `📋 /auth/me returned subscription_status: ${user.subscription_status}`,
            );

            localStorage.setItem(AUTH_TOKEN_KEY, authToken);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
            setCurrentUser(user);

            return; // Success, stop retries
          }
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
      const response = await fetch("http://localhost:8000/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const user = await response.json();
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        setAuthToken(token);
        setCurrentUser(user);
        console.log("✅ Full user loaded from /auth/me:", user);

        if (user.subscription_status === "pro") {
          setShowUpgradeSuccess(true);
          setTimeout(() => setShowUpgradeSuccess(false), 6000);
          console.log("🎉 User is now Pro!");
        }
      } else {
        console.error("Failed to fetch /auth/me:", response.status);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
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
    if (!authToken) return;
    try {
      const res = await fetch(
        "http://localhost:8000/api/create-checkout-session",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade error:", err);
    }
  };

  return (
    <div
      className={`min-h-screen pb-20 xl:pb-0 ${theme === "light" ? "theme-light bg-stone-100 text-stone-900" : "bg-gray-900"}`}
    >
      <nav
        className="sticky top-0 z-50 text-stone-100 shadow-lg border-b border-yellow-900/60"
        style={{ backgroundColor: "#92400e" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between xl:justify-center flex-col">
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
            {currentUser && currentUser.subscription_status !== "pro" && (
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
              <button
                className="flex flex-col gap-1.5 p-2 focus:outline-none"
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
            <ul className="xl:hidden flex flex-col border-t border-yellow-900/60 w-full">
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
              {currentUser && currentUser.subscription_status !== "pro" && (
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
        <Route path="/manual-teams" element={<ManualTeams />} />
        <Route
          path="/fight-analyzer"
          element={<FightAnalyzer eventTitle={eventTitle} />}
        />
        <Route path="/video-vault" element={<VideoVault />} />
        <Route path="/videos-v2" element={<VideosV2 />} />
        <Route path="/odds" element={<LatestOdds />} />
        <Route
          path="/predictions"
          element={<DFSPicksProjections eventTitle={eventTitle} />}
        />
        <Route path="/video-studio" element={<VideoStudio />} />
        <Route path="/my-lineups" element={<MySavedLineups />} />
        <Route
          path="/dashboard"
          element={<UserDashboard currentUser={currentUser} />}
        />
      </Routes>
      <Footer />

      <nav
        className={`xl:hidden fixed bottom-0 left-0 right-0 z-[60] border-t border-yellow-900/60 backdrop-blur ${theme === "light" ? "bg-amber-100/95" : "bg-stone-950/95"}`}
        aria-label="Mobile quick navigation"
      >
        <ul className="grid grid-cols-5">
          {mobileNavLinks.map(({ to, label, icon }) => {
            const active =
              to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`flex min-h-[56px] items-center justify-center tracking-wide transition ${
                    compactBottomNav ? "px-1" : "flex-col gap-0.5 text-[10px]"
                  } ${
                    active
                      ? "text-yellow-400 bg-yellow-900/20"
                      : theme === "light"
                        ? "text-stone-600 hover:text-amber-700"
                        : "text-stone-400 hover:text-yellow-500"
                  }`}
                  aria-label={label}
                >
                  <span
                    className={`leading-none ${compactBottomNav ? "text-lg" : "text-base"}`}
                  >
                    {icon}
                  </span>
                  {(!compactBottomNav || active) && (
                    <span className={compactBottomNav ? "text-[9px] ml-1" : ""}>
                      {label}
                    </span>
                  )}
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
