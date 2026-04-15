import React, { useState, useRef, useEffect } from "react";
import api from "../services/api";

const AuthModal = ({
  isOpen,
  onClose,
  defaultTab = "login",
  onLoginSuccess, // New: called when login works
  onRegisterSuccess, // New: called when register works
}) => {
  const [currentTab, setCurrentTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const firstInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentTab(defaultTab);
      setError("");
      setLoginEmail("");
      setLoginPassword("");
      setRegEmail("");
      setRegUsername("");
      setRegPassword("");
      setTimeout(() => firstInputRef.current?.focus(), 150);
    }
  }, [isOpen, defaultTab]);

  const switchTab = (tab) => {
    setCurrentTab(tab);
    setError("");
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    api
      .post("/auth/login", { email: loginEmail, password: loginPassword })
      .then((data) => {
        setLoading(false);
        onLoginSuccess(data.access_token, data.user);
        onClose();
      })
      .catch((error) => {
        setLoading(false);
        setError(error.message);
      });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (!regEmail || !regUsername || !regPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (regPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError("");

    api
      .post("/auth/register", {
        email: regEmail,
        username: regUsername,
        password: regPassword,
      })
      .then((data) => {
        setLoading(false);
        onRegisterSuccess(data.access_token, data.user);
        onClose();
      })
      .catch((error) => {
        setLoading(false);
        setError(error.message);
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-stone-900 rounded-xl w-full max-w-md overflow-hidden relative">
        {/* Tabs */}
        <div className="flex border-b border-stone-700">
          <button
            onClick={() => switchTab("login")}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              currentTab === "login"
                ? "text-white border-b-2 border-yellow-500"
                : "text-stone-400 hover:text-stone-300"
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => switchTab("register")}
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              currentTab === "register"
                ? "text-white border-b-2 border-yellow-500"
                : "text-stone-400 hover:text-stone-300"
            }`}
          >
            Register
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 text-red-400 rounded text-sm">
              {error}
            </div>
          )}

          {/* LOGIN FORM */}
          {currentTab === "login" && (
            <form onSubmit={handleLogin} noValidate autoComplete="off">
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-widest text-stone-400 mb-1">
                  Email
                </label>
                <input
                  ref={firstInputRef}
                  type="email"
                  autoComplete="off"
                  required
                  className="w-full bg-stone-800 border border-stone-700 rounded px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs uppercase tracking-widest text-stone-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full bg-stone-800 border border-stone-700 rounded px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold py-3 rounded transition"
              >
                {loading ? "Logging in…" : "Log In"}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {currentTab === "register" && (
            <form onSubmit={handleRegister} noValidate autoComplete="off">
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-widest text-stone-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="off"
                  required
                  className="w-full bg-stone-800 border border-stone-700 rounded px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs uppercase tracking-widest text-stone-400 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  required
                  className="w-full bg-stone-800 border border-stone-700 rounded px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                  placeholder="e.g. knockout_king"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                />
                <p className="text-xs text-stone-500 mt-1">
                  This is what others will see
                </p>
              </div>
              <div className="mb-6">
                <label className="block text-xs uppercase tracking-widest text-stone-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full bg-stone-800 border border-stone-700 rounded px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                  placeholder="Min 8 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold py-3 rounded transition"
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>
            </form>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white text-2xl leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
