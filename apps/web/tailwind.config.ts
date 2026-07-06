import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic verdict palette (used by VerdictBadge / score bars).
        signal: {
          strong: "#16a34a",
          solid: "#65a30d",
          mixed: "#d97706",
          weak: "#dc2626",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
