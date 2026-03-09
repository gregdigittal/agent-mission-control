import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#06080c",
          1: "#0b0e14",
          2: "#10141c",
          3: "#161b26",
          4: "#1c2232",
          5: "#242b3d",
        },
        border: {
          1: "#1a2030",
          2: "#242e42",
          3: "#2e3a52",
        },
        text: {
          1: "#edf0f7",
          2: "#b0b8cc",
          3: "#6e7a94",
          4: "#3e4a64",
        },
        cyan: "#22d3ee",
        green: "#34d399",
        amber: "#fbbf24",
        red: "#f87171",
        violet: "#a78bfa",
        blue: "#60a5fa",
        rose: "#fb7185",
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "monospace"],
        sans: ["var(--font-geist-sans)", "sans-serif"],
      },
      fontSize: {
        xxs: "var(--font-xxs, 10px)",
        xs: "var(--font-xs, 11px)",
        sm: "var(--font-sm, 12px)",
        base: "var(--font-base, 13px)",
      },
      animation: {
        pulse: "pulse 2s infinite",
        "typing-dot": "typingDot 0.8s infinite",
        "feed-in": "feedIn 0.3s ease-out",
        "pulse-dot": "pulseDot 1.5s ease-in-out infinite",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        typingDot: {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "1" },
        },
        feedIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.8)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
