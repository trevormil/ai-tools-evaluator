import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // "Test Bench" trio (loaded via next/font in app/layout.tsx):
        // Archivo display, Instrument Sans body, IBM Plex Mono readouts.
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        // Theme-token bridges for Tailwind utilities (values come from CSS vars).
        brand: {
          DEFAULT: "var(--brand)",
          bright: "var(--brand-bright)",
          soft: "var(--brand-soft)",
        },
        // Semantic verdict palette (used by VerdictBadge / score bars).
        signal: {
          strong: "#16a34a",
          solid: "#0d9488",
          mixed: "#d97706",
          weak: "#dc2626",
        },
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
