/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.css",
    "./public/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ["Orbitron", "sans-serif"],
      },
      colors: {
        primary: "#ff2d55", // Neon red for UFC vibe
        secondary: "#0aff99", // Neon green for buttons
        background: "#111827", // Dark premium background
        card: "#1f2937", // Card background
      },
      boxShadow: {
        neon: "0 0 10px #ff2d55, 0 0 20px #0aff99, 0 0 30px rgba(229, 231, 235, 0.3)",
        pearl:
          "0 4px 6px -1px rgba(255, 255, 255, 0.1), 0 2px 4px -1px rgba(255, 255, 255, 0.06)",
      },
      backgroundImage: {
        gradient: "linear-gradient(to right, #ff2d55, #0aff99)",
        hero: "url('https://source.unsplash.com/random/1920x1080/?mma,fight')",
      },
      animation: {
        fadeIn: "fadeIn 1s ease-in-out",
        slideUp: "slideUp 0.5s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
      },
    },
  },
  safelist: [
    "bg-cyan-500",
    "bg-cyan-600",
    "hover:bg-cyan-400",
    "text-slate-900",
    "border-cyan-500",
    "border-cyan-500/40",
    "text-cyan-400",
  ],
  plugins: [require("@tailwindcss/forms")],
};
