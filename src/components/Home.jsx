import React from "react";
import { Link } from "react-router-dom";

const cards = [
  {
    to: "/fight-analyzer",
    title: "Fight Analyzer",
    desc: "Analyze strike stats, grappling data, and fight history. Predict outcomes with military precision.",
    cta: "Engage",
    icon: "⊕",
    tag: "INTEL",
  },
  {
    to: "/team-combinations",
    title: "DFS Team Builder",
    desc: "Deploy optimal DraftKings squads with custom fighter limits. Dominate the field with calculated force.",
    cta: "Deploy",
    icon: "◈",
    tag: "OPS",
  },
  {
    to: "/video-vault",
    title: "Video Vault",
    desc: "Access classified fight footage. Study enemy movements. Relive critical moments in the octagon.",
    cta: "Access",
    icon: "▣",
    tag: "ARCHIVE",
  },
  {
    to: "/predictions",
    title: "Make Prediction",
    desc: "Submit your prediction report. Tactical analysis of fight matchups with expert intelligence.",
    cta: "Submit Report",
    icon: "◉",
    tag: "REPORT",
  },
  {
    to: "/manual-teams",
    title: "Manual Teams",
    desc: "Direct control over every fighter selection. Full command authority. No automated deployment.",
    cta: "Take Command",
    icon: "⊗",
    tag: "COMMAND",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-950">
      {/* Video bg */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover opacity-25 grayscale sepia"
      >
        <source src="/ufc-fight-loop.mp4" type="video/mp4" />
      </video>

      {/* Camo texture overlay */}
      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 35%, #4a5240 15%, transparent 15%),
            radial-gradient(circle at 75% 15%, #3a4230 10%, transparent 10%),
            radial-gradient(circle at 55% 65%, #4a5240 20%, transparent 20%),
            radial-gradient(circle at 10% 80%, #3a4230 12%, transparent 12%),
            radial-gradient(circle at 90% 70%, #4a5240 18%, transparent 18%)`,
          backgroundSize: "120px 120px",
          backgroundColor: "#2d3020",
        }}
      ></div>

      {/* Dark gradient overlay */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.55) 100%)",
        }}
      ></div>

      <div
        className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4 py-4"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        {/* Classification banner */}
        <div className="w-full max-w-7xl mb-4">
          <div className="flex items-center justify-between border border-yellow-700/50 bg-yellow-900/20 px-4 py-2">
            <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
              ⚡ CLASSIFIED
            </span>
            <span className="text-yellow-500/60 text-xs tracking-wider">
              CLEARANCE: LEVEL 5
            </span>
            <span className="text-yellow-500 text-xs font-bold tracking-widest uppercase">
              TOP SECRET ⚡
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-5 max-w-3xl">
          <div className="text-xs text-stone-400 tracking-[0.5em] uppercase mb-3">
            ◆ OPERATION COMBAT VAULT ◆
          </div>
          <h1
            className="text-4xl md:text-6xl font-black text-stone-100 tracking-wider uppercase leading-none mb-4 whitespace-nowrap"
            style={{
              fontFamily: "'Impact', sans-serif",
              textShadow:
                "2px 2px 0 #4a5240, 4px 4px 0 #2d3020, 0 0 40px rgba(100,120,80,0.3)",
            }}
          >
            THE <span className="text-yellow-600">COMBAT</span> VAULT
          </h1>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-yellow-700 to-transparent mx-auto mb-4"></div>
          <p className="text-stone-400 text-sm leading-relaxed tracking-wide">
            Step into the octagon with cutting-edge MMA betting tools—analyze
            fights, build DFS teams, and dominate the cage!
          </p>
          <p className="text-stone-600 text-xs mt-3 tracking-widest uppercase">
            ⚠ For Entertainment Only · 21+ · 1-800-GAMBLER
          </p>
        </div>

        {/* Shields */}
        <div className="flex flex-wrap justify-center items-end gap-6 w-full max-w-7xl">
          {cards.map(({ to, title, desc, cta, icon, tag }, i) => {
            const palette = [
              {
                fill: "#3b1f06",
                dark: "#200e02",
                rim: "#92400e",
                accent: "#fbbf24",
                stripe: "#78350f",
                glow: "rgba(251,191,36,0.4)",
                label: "I",
              },
              {
                fill: "#1a1a10",
                dark: "#0d0d08",
                rim: "#71635a",
                accent: "#d6c68a",
                stripe: "#44403c",
                glow: "rgba(214,198,138,0.35)",
                label: "II",
              },
              {
                fill: "#2c1810",
                dark: "#180c06",
                rim: "#b45309",
                accent: "#f59e0b",
                stripe: "#92400e",
                glow: "rgba(245,158,11,0.4)",
                label: "III",
              },
              {
                fill: "#1c1f10",
                dark: "#0f1108",
                rim: "#4a5240",
                accent: "#a3a830",
                stripe: "#3a4230",
                glow: "rgba(163,168,48,0.35)",
                label: "IV",
              },
              {
                fill: "#2a1208",
                dark: "#160904",
                rim: "#7c3010",
                accent: "#ea8c34",
                stripe: "#7c2d12",
                glow: "rgba(234,140,52,0.4)",
                label: "V",
              },
            ];
            const p = palette[i];

            // Shield outer path — classic heater shape, viewBox 0 0 200 265
            const S =
              "M 22,0 L 178,0 Q 200,0 200,22 L 200,158 Q 200,192 100,265 Q 0,192 0,158 L 0,22 Q 0,0 22,0 Z";
            // Rim inset 1 (thick metallic border)
            const R1 =
              "M 26,5 L 174,5 Q 194,5 194,26 L 194,157 Q 194,188 100,257 Q 6,188 6,157 L 6,26 Q 6,5 26,5 Z";
            // Rim inset 2 (thin decorative line)
            const R2 =
              "M 30,10 L 170,10 Q 188,10 188,30 L 188,155 Q 188,184 100,249 Q 12,184 12,155 L 12,30 Q 12,10 30,10 Z";
            // Lance notch (top-right cut used in jousting shields)
            const NOTCH =
              "M 148,0 L 178,0 Q 200,0 200,22 L 200,48 L 172,48 L 172,22 Q 172,16 162,16 L 148,16 Z";

            return (
              <Link
                key={to}
                to={to}
                className="group hover:scale-105 transition-all duration-500 flex flex-col items-center"
                style={{
                  width: "clamp(175px, 17vw, 220px)",
                  filter: `drop-shadow(0 8px 28px ${p.glow}) drop-shadow(0 2px 4px rgba(0,0,0,0.8))`,
                  fontFamily:
                    "'Roboto Mono', 'IBM Plex Mono', 'Courier New', monospace",
                }}
              >
                {/* Shield wrapper — SVG + overlay together */}
                <div style={{ position: "relative", width: "100%" }}>
                  {/* SVG Shield — decorative layer, sits behind content */}
                  <svg
                    viewBox="0 0 200 265"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full block"
                    style={{ display: "block" }}
                  >
                    <defs>
                      <linearGradient
                        id={`grad-${i}`}
                        x1="0%"
                        y1="0%"
                        x2="60%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor={p.rim} stopOpacity="0.9" />
                        <stop offset="50%" stopColor={p.fill} stopOpacity="1" />
                        <stop
                          offset="100%"
                          stopColor={p.dark}
                          stopOpacity="1"
                        />
                      </linearGradient>
                      <linearGradient
                        id={`rimgrad-${i}`}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor={p.accent}
                          stopOpacity="0.9"
                        />
                        <stop offset="40%" stopColor={p.rim} stopOpacity="1" />
                        <stop
                          offset="100%"
                          stopColor={p.dark}
                          stopOpacity="1"
                        />
                      </linearGradient>
                      <clipPath id={`clip-${i}`}>
                        <path d={S} />
                      </clipPath>
                    </defs>

                    {/* Main shield body */}
                    <path d={S} fill={`url(#rimgrad-${i})`} />
                    {/* Fill body (slightly inset to show rim) */}
                    <path d={R1} fill={`url(#grad-${i})`} />

                    {/* Lance notch — punched out of top-right (fill with dark) */}
                    <path d={NOTCH} fill="#0a0a08" />
                    {/* Notch inner edge lines */}
                    <polyline
                      points="148,16 172,16 172,48"
                      fill="none"
                      stroke={p.rim}
                      strokeWidth="1"
                      opacity="0.8"
                    />

                    {/* Inner decorative rim line */}
                    <path
                      d={R2}
                      fill="none"
                      stroke={p.accent}
                      strokeWidth="0.7"
                      opacity="0.35"
                    />

                    {/* Quartered cross — faint etching behind content */}
                    <line
                      x1="100"
                      y1="12"
                      x2="100"
                      y2="138"
                      stroke={p.accent}
                      strokeWidth="0.5"
                      opacity="0.12"
                    />
                    <line
                      x1="14"
                      y1="80"
                      x2="186"
                      y2="80"
                      stroke={p.accent}
                      strokeWidth="0.5"
                      opacity="0.12"
                    />

                    {/* === EDGE DETAILS (rim area — no words here) === */}

                    {/* Left edge rivet row */}
                    <circle
                      cx="10"
                      cy="50"
                      r="2.2"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.6"
                      opacity="0.7"
                    />
                    <circle
                      cx="9"
                      cy="75"
                      r="2.2"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.6"
                      opacity="0.7"
                    />
                    <circle
                      cx="9"
                      cy="100"
                      r="2.2"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.6"
                      opacity="0.7"
                    />
                    <circle
                      cx="10"
                      cy="125"
                      r="2.2"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.6"
                      opacity="0.7"
                    />
                    {/* Right edge rivet row */}
                    <circle
                      cx="190"
                      cy="50"
                      r="2.2"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.6"
                      opacity="0.7"
                    />
                    <circle
                      cx="191"
                      cy="75"
                      r="2.2"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.6"
                      opacity="0.7"
                    />
                    <circle
                      cx="191"
                      cy="100"
                      r="2.2"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.6"
                      opacity="0.7"
                    />
                    <circle
                      cx="190"
                      cy="125"
                      r="2.2"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.6"
                      opacity="0.7"
                    />

                    {/* Top corner rivets */}
                    <circle
                      cx="32"
                      cy="20"
                      r="3.5"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.8"
                      opacity="0.85"
                    />
                    <circle
                      cx="168"
                      cy="20"
                      r="3.5"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.8"
                      opacity="0.85"
                    />
                    {/* Rivet shine dot */}
                    <circle
                      cx="31"
                      cy="19"
                      r="1"
                      fill={p.accent}
                      opacity="0.5"
                    />
                    <circle
                      cx="167"
                      cy="19"
                      r="1"
                      fill={p.accent}
                      opacity="0.5"
                    />

                    {/* === LOWER POINT AREA decorations (below content) === */}
                    {/* Chevron / V-stripe pointing down toward tip */}
                    <polyline
                      points="30,172 100,218 170,172"
                      fill="none"
                      stroke={p.accent}
                      strokeWidth="1"
                      opacity="0.3"
                      clipPath={`url(#clip-${i})`}
                    />
                    <polyline
                      points="44,172 100,208 156,172"
                      fill="none"
                      stroke={p.accent}
                      strokeWidth="0.6"
                      opacity="0.2"
                      clipPath={`url(#clip-${i})`}
                    />

                    {/* Small boss in the lower point — safe below all words */}
                    <circle
                      cx="100"
                      cy="220"
                      r="10"
                      fill={p.dark}
                      stroke={p.accent}
                      strokeWidth="1.2"
                      opacity="0.85"
                    />
                    <circle
                      cx="100"
                      cy="220"
                      r="6.5"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.8"
                      opacity="0.75"
                    />
                    <circle
                      cx="100"
                      cy="220"
                      r="3"
                      fill={p.accent}
                      opacity="0.9"
                    />
                    {/* Boss shine */}
                    <circle
                      cx="98"
                      cy="218"
                      r="1"
                      fill="white"
                      opacity="0.25"
                    />

                    {/* Tip rivet */}
                    <circle
                      cx="100"
                      cy="246"
                      r="2.5"
                      fill={p.rim}
                      stroke={p.accent}
                      strokeWidth="0.8"
                      opacity="0.6"
                    />

                    {/* Top hanging loop */}
                    <rect
                      x="90"
                      y="0"
                      width="20"
                      height="5"
                      rx="2"
                      fill={p.accent}
                      opacity="0.6"
                    />
                    <ellipse
                      cx="100"
                      cy="3"
                      rx="6"
                      ry="4"
                      fill="none"
                      stroke={p.accent}
                      strokeWidth="1"
                      opacity="0.5"
                    />

                    {/* TAG banner */}
                    <rect
                      x="52"
                      y="18"
                      width="96"
                      height="14"
                      rx="1"
                      fill={p.dark}
                      stroke={p.accent}
                      strokeWidth="0.8"
                      opacity="0.95"
                    />
                    <text
                      x="100"
                      y="28"
                      textAnchor="middle"
                      fontSize="6.5"
                      fontFamily="'Courier New',monospace"
                      fontWeight="bold"
                      fill={p.accent}
                      letterSpacing="2"
                      opacity="0.95"
                    >
                      {tag}
                    </text>

                    {/* Roman numeral at tip */}
                    <text
                      x="100"
                      y="256"
                      textAnchor="middle"
                      fontSize="7"
                      fontFamily="'Courier New',monospace"
                      fill={p.accent}
                      opacity="0.4"
                      letterSpacing="2"
                    >
                      {p.label}
                    </text>
                  </svg>

                  {/* HTML content — absolutely positioned inside shield */}
                  <div
                    style={{
                      position: "absolute",
                      top: "13%",
                      left: "10%",
                      right: "10%",
                      bottom: "28%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: "10px",
                      paddingTop: "18px",
                      textAlign: "center",
                      pointerEvents: "none",
                      fontFamily:
                        "'Roboto Mono', 'IBM Plex Mono', 'Courier New', monospace",
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        fontSize: "2.2rem",
                        color: p.accent,
                        lineHeight: 1,
                        textShadow: `0 0 18px ${p.glow}, 0 0 6px rgba(255,255,255,0.15)`,
                      }}
                    >
                      {icon}
                    </div>

                    {/* Title */}
                    <h2
                      style={{
                        color: p.accent,
                        fontSize: "0.95rem",
                        fontWeight: "900",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        textShadow: `0 0 10px ${p.glow}, 0 0 4px currentColor, 0 1px 3px rgba(0,0,0,0.8)`,
                        lineHeight: 1.25,
                        margin: 0,
                      }}
                    >
                      {title}
                    </h2>

                    {/* Thin rule */}
                    <div
                      style={{
                        width: "65%",
                        height: "1px",
                        background: p.accent,
                        opacity: 0.4,
                      }}
                    ></div>

                    {/* Description */}
                    <p
                      style={{
                        color: "#e5e7eb",
                        fontSize: "0.75rem",
                        lineHeight: 1.55,
                        margin: 0,
                        textShadow:
                          "0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(255,255,255,0.08)",
                      }}
                    >
                      {desc}
                    </p>
                  </div>
                </div>
                {/* end shield wrapper */}

                {/* CTA button — below shield in normal flow */}
                <div
                  style={{
                    width: "100%",
                    background: p.accent,
                    border: `1px solid ${p.accent}`,
                    color: "#0c0a00",
                    fontSize: "0.8rem",
                    fontWeight: "900",
                    padding: "7px 13px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    textAlign: "center",
                    boxShadow: `0 4px 16px ${p.glow}, 0 1px 0 rgba(255,255,255,0.15) inset`,
                    fontFamily:
                      "'Roboto Mono', 'IBM Plex Mono', 'Courier New', monospace",
                    marginTop: "6px",
                  }}
                >
                  ▶ {cta}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 w-full max-w-7xl">
          <div className="border-t border-stone-700/50 pt-4 flex justify-between items-center">
            <span className="text-stone-600 text-xs tracking-widest uppercase">
              End Of Briefing
            </span>
            <Link
              to="/"
              className="text-stone-500 hover:text-yellow-500 text-xs tracking-widest uppercase transition-colors duration-200"
            >
              ← Back To Base
            </Link>
            <span className="text-stone-600 text-xs tracking-widest uppercase">
              Destroy After Reading
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
