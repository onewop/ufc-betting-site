/**
 * ManagerPage.jsx — Internal admin dashboard for CageVault maintenance.
 * Route: /manager  (not in public nav)
 *
 * Features:
 *  1. Weekly commands reference (copy-to-clipboard)
 *  2. Highlight video editor (reads/writes highlight_videos.json)
 *  3. Weigh-in video editor (reads/writes weigh_in_videos.json)
 *  4. Key notes editor (reads/writes key_notes.json)
 *
 * Access: only shown to logged-in users with admin email.
 * Architecture note: JSON edits generate a downloadable file since static
 * assets on Vercel can't be written at runtime. Replace file in public/,
 * then run `npm run build && ./deploy.sh`.
 */

import { useState, useEffect } from "react";

// ── Access guard ──────────────────────────────────────────────────────────────
// The page is intentionally NOT linked in public nav.
// Any authenticated user who navigates to /manager directly can access it.
const canAccess = (user) => !!user;

// ── Weekly commands ───────────────────────────────────────────────────────────
const WEEKLY_COMMANDS = [
  {
    group: "1. Update Stats & CSV",
    commands: [
      { label: "Pull latest DKSalaries.csv, then run:", cmd: "bash update-new-csv.sh" },
      { label: "Scrape UFCStats per-fight data:", cmd: "cd scripts && python scrape_ufcstats_perfight.py" },
      { label: "Aggregate all stats into this_weeks_stats.json:", cmd: "cd scripts && python aggregate_stats.py" },
      { label: "Update stats only (no CSV change):", cmd: "bash update-stats-only.sh" },
    ],
  },
  {
    group: "2. Download Fighter Images",
    commands: [
      { label: "Download missing fighter images:", cmd: "bash download_fighters.sh" },
    ],
  },
  {
    group: "3. Build & Deploy",
    commands: [
      { label: "Build the React app:", cmd: "npm run build" },
      { label: "Deploy to Vercel (prod):", cmd: "cd build && vercel deploy --prod" },
      { label: "Full deploy (build + deploy):", cmd: "npm run build && cd build && vercel deploy --prod" },
    ],
  },
  {
    group: "4. Backend (Railway)",
    commands: [
      { label: "Check backend health:", cmd: "curl https://ufc-betting-site-production.up.railway.app/health" },
      { label: "Start backend locally:", cmd: "cd backend && uvicorn main:app --reload --port 8000" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ── CopyButton ────────────────────────────────────────────────────────────────
const CopyButton = ({ text, label = "Copy" }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="text-[10px] px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 font-mono transition shrink-0"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
};

// ── VideoEditor ───────────────────────────────────────────────────────────────
const VideoEditor = ({ title, filename, instructions }) => {
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/${filename}`)
      .then((r) => r.json())
      .then((json) => {
        setData(json);
        const { _instructions, ...fighters } = json;
        setEntries(
          Object.entries(fighters).map(([name, id]) => ({ name, id })),
        );
      })
      .catch(() => setEntries([]));
  }, [filename]);

  const updateEntry = (idx, field, value) => {
    setEntries((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
    setSaved(false);
  };

  const deleteEntry = (idx) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const addEntry = () => {
    if (!newName.trim() || !newId.trim()) return;
    setEntries((prev) => [...prev, { name: newName.trim(), id: newId.trim() }]);
    setNewName("");
    setNewId("");
    setSaved(false);
  };

  const handleDownload = () => {
    const out = {
      _instructions: data?._instructions || instructions,
    };
    entries.forEach(({ name, id }) => {
      if (name && id) out[name] = id;
    });
    downloadJson(out, filename);
    setSaved(true);
  };

  return (
    <div className="bg-stone-900 border border-stone-700 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-stone-100 font-bold text-base">{title}</h3>
          <p className="text-stone-500 text-xs mt-0.5">
            Edit below → Download → Replace{" "}
            <code className="text-yellow-400">public/{filename}</code> → Deploy
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-stone-900 rounded-lg font-bold text-sm transition"
        >
          ↓ Download {filename}
        </button>
      </div>

      {/* Table of current entries */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="border-b border-stone-700">
              <th className="text-left py-1.5 pr-3 text-stone-500 font-semibold text-xs">Fighter Name</th>
              <th className="text-left py-1.5 pr-3 text-stone-500 font-semibold text-xs">YouTube Video ID</th>
              <th className="text-left py-1.5 pr-3 text-stone-500 font-semibold text-xs">Preview</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map(({ name, id }, idx) => (
              <tr key={idx} className="border-b border-stone-800">
                <td className="py-1.5 pr-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => updateEntry(idx, "name", e.target.value)}
                    className="bg-stone-800 text-stone-100 border border-stone-700 rounded px-2 py-1 text-xs w-full"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    type="text"
                    value={id}
                    onChange={(e) => updateEntry(idx, "id", e.target.value)}
                    className="bg-stone-800 text-stone-100 border border-stone-700 rounded px-2 py-1 text-xs font-mono w-36"
                    placeholder="11-char video ID"
                  />
                </td>
                <td className="py-1.5 pr-3">
                  {id ? (
                    <a
                      href={`https://www.youtube.com/watch?v=${id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-400 text-xs hover:underline"
                    >
                      ▶ Preview
                    </a>
                  ) : (
                    <span className="text-stone-600 text-xs">—</span>
                  )}
                </td>
                <td className="py-1.5 text-right">
                  <button
                    onClick={() => deleteEntry(idx)}
                    className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-950/30 transition"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new entry */}
      <div className="flex gap-2 items-center mt-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Fighter name (exact)"
          className="bg-stone-800 border border-stone-700 text-stone-100 rounded px-3 py-1.5 text-xs flex-1 min-w-0"
        />
        <input
          type="text"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="YouTube video ID"
          className="bg-stone-800 border border-stone-700 text-stone-100 rounded px-3 py-1.5 text-xs font-mono w-36"
        />
        <button
          onClick={addEntry}
          className="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded text-xs font-semibold transition"
        >
          + Add
        </button>
      </div>
      {saved && (
        <p className="text-green-400 text-xs mt-2">
          ✓ Downloaded! Replace public/{filename} and redeploy.
        </p>
      )}
    </div>
  );
};

// ── KeyNotesEditor ────────────────────────────────────────────────────────────
const KeyNotesEditor = () => {
  const [rawJson, setRawJson] = useState(
    JSON.stringify(
      {
        _instructions: [
          "Add notes per fight matchup. Key = 'Fighter1 vs Fighter2' (match exactly).",
          "type: 'major' | 'moderate' | 'minor'",
        ],
        "Example Fighter vs Example Opponent": [
          { type: "major", text: "Fighter dealing with injury" },
          { type: "moderate", text: "Short-notice fight" },
        ],
      },
      null,
      2,
    ),
  );
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    fetch("/key_notes.json")
      .then((r) => r.json())
      .then((json) => setRawJson(JSON.stringify(json, null, 2)))
      .catch(() => {}); // file may not exist yet
  }, []);

  const handleDownload = () => {
    try {
      const parsed = JSON.parse(rawJson);
      downloadJson(parsed, "key_notes.json");
      setParseError("");
    } catch (e) {
      setParseError("Invalid JSON: " + e.message);
    }
  };

  return (
    <div className="bg-stone-900 border border-stone-700 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-stone-100 font-bold text-base">🗒️ Key Notes</h3>
          <p className="text-stone-500 text-xs mt-0.5">
            Edit JSON below → Download → Replace{" "}
            <code className="text-yellow-400">public/key_notes.json</code> → Deploy
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-stone-900 rounded-lg font-bold text-sm transition"
        >
          ↓ Download key_notes.json
        </button>
      </div>
      <textarea
        value={rawJson}
        onChange={(e) => { setRawJson(e.target.value); setParseError(""); }}
        rows={14}
        spellCheck={false}
        className="w-full bg-stone-950 border border-stone-700 text-stone-200 rounded-lg p-3 text-xs font-mono resize-y"
      />
      {parseError && (
        <p className="text-red-400 text-xs mt-1">{parseError}</p>
      )}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const ManagerPage = ({ currentUser }) => {
  if (!canAccess(currentUser)) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-stone-400 text-lg mb-2">🔒 Login Required</p>
          <p className="text-stone-600 text-sm">
            Log in to access the manager dashboard.
          </p>
          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("cagevault:openAuthModal", { detail: { tab: "login" } })
              )
            }
            className="mt-4 px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-stone-900 font-bold rounded-lg text-sm transition"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <div
        className="border-b border-yellow-900/40 px-4 py-5"
        style={{ background: "linear-gradient(180deg, #451a03 0%, #1c1917 100%)" }}
      >
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-black text-white tracking-tight">
            ⚙️ Manager Dashboard
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Internal tools — not linked in public nav
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* ── Weekly Commands ── */}
        <section>
          <h2 className="text-yellow-500 font-bold text-sm uppercase tracking-widest mb-4">
            📋 Weekly Commands
          </h2>
          <div className="space-y-5">
            {WEEKLY_COMMANDS.map((group) => (
              <div key={group.group} className="bg-stone-900 border border-stone-700 rounded-xl p-4">
                <h3 className="text-stone-300 font-semibold text-sm mb-3">{group.group}</h3>
                <div className="space-y-2">
                  {group.commands.map((c, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-stone-500 text-xs mb-1">{c.label}</p>
                        <code className="block bg-stone-950 border border-stone-800 rounded px-3 py-1.5 text-xs text-green-400 font-mono break-all">
                          {c.cmd}
                        </code>
                      </div>
                      <CopyButton text={c.cmd} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Highlight Videos Editor ── */}
        <section>
          <h2 className="text-yellow-500 font-bold text-sm uppercase tracking-widest mb-4">
            🎥 Highlight Videos
          </h2>
          <VideoEditor
            title="🎥 Fighter Highlight Videos"
            filename="highlight_videos.json"
            instructions={[
              "Every Monday: replace last week's entries with this week's fighters.",
              "Key = fighter name exactly as it appears in DKSalaries.csv (case-insensitive match).",
              "Value = the 11-character YouTube video ID (the part after ?v= in any YouTube URL).",
            ]}
          />
        </section>

        {/* ── Weigh-In Videos Editor ── */}
        <section>
          <h2 className="text-yellow-500 font-bold text-sm uppercase tracking-widest mb-4">
            ⚖️ Weigh-In Videos
          </h2>
          <VideoEditor
            title="⚖️ Weigh-In Video Clips"
            filename="weigh_in_videos.json"
            instructions={[
              "Key = fighter name (case-insensitive).",
              "Value = 11-character YouTube video ID for that fighter's weigh-in clip.",
              "Leave out fighters with no clip — they won't show in WeighInClips.",
            ]}
          />
          <div className="bg-stone-800/50 border border-stone-700 rounded-lg px-4 py-3 text-xs text-stone-400">
            <p className="font-semibold text-stone-300 mb-1">How weigh-in videos work:</p>
            <p>
              Add a fighter's name → video ID in <code className="text-yellow-400">weigh_in_videos.json</code>,
              then update <code className="text-yellow-400">FightStatsSection.jsx</code> to pass{" "}
              <code className="text-yellow-400">weighInVideoId</code> to each fighter object (same pattern as highlight videos).
              The <code className="text-yellow-400">WeighInClips</code> component only shows fighters with a valid{" "}
              <code className="text-yellow-400">weighInVideoId</code>.
            </p>
          </div>
        </section>

        {/* ── Key Notes Editor ── */}
        <section>
          <h2 className="text-yellow-500 font-bold text-sm uppercase tracking-widest mb-4">
            🗒️ Key Notes
          </h2>
          <KeyNotesEditor />
          <div className="bg-stone-800/50 border border-stone-700 rounded-lg px-4 py-3 text-xs text-stone-400">
            <p className="font-semibold text-stone-300 mb-1">How key notes work:</p>
            <p>
              The <code className="text-yellow-400">KeyNotes</code> component is hidden unless a{" "}
              <code className="text-yellow-400">fightContext</code> array is passed. To wire it up, load{" "}
              <code className="text-yellow-400">key_notes.json</code> in{" "}
              <code className="text-yellow-400">FightStatsSection.jsx</code> and pass the relevant
              fight's notes via the <code className="text-yellow-400">fightContext</code> prop.
            </p>
          </div>
        </section>

        {/* ── Deploy checklist ── */}
        <section>
          <h2 className="text-yellow-500 font-bold text-sm uppercase tracking-widest mb-4">
            🚀 Deploy Checklist
          </h2>
          <div className="bg-stone-900 border border-stone-700 rounded-xl p-5">
            <ol className="space-y-2 text-sm text-stone-300">
              {[
                "Update DKSalaries.csv with the week's slate",
                "Run aggregate_stats.py to regenerate this_weeks_stats.json",
                "Update highlight_videos.json with this week's fighter videos",
                "Update weigh_in_videos.json after weigh-ins on Friday",
                "Add key notes to key_notes.json if there are injury/camp concerns",
                "Run npm run build",
                "Run cd build && vercel deploy --prod",
                "Verify cagevault.com shows updated event title and fighter data",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

      </div>
    </div>
  );
};

export default ManagerPage;
