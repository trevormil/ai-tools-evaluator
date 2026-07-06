/**
 * Audience fit. AIx's north star is the **AI-first engineer** — technical,
 * wants to upskill and sharpen their workflow — NOT the "vibe coder" who just
 * wants a flashier tool to do the work for them. But the line is genuinely
 * fuzzy: AI engineers also want tools that improve their workflow. So we don't
 * force a binary. We score BOTH audiences independently (0–100) and tag a
 * primary, with a one-line rationale for the call.
 */
export const PRIMARY_AUDIENCES = ["ai-engineer", "vibe-coder", "both", "neither"] as const;
export type PrimaryAudience = (typeof PRIMARY_AUDIENCES)[number];

export const PRIMARY_AUDIENCE_LABELS: Record<PrimaryAudience, string> = {
  "ai-engineer": "AI-first Engineer",
  "vibe-coder": "Vibe Coder",
  both: "Both",
  neither: "Neither",
};

export const AUDIENCE_AXES = [
  {
    key: "aiEngineerFit",
    label: "AI-first Engineer",
    desc: "Depth and leverage for a technical engineer who wants to understand it and level up their workflow — not just offload work.",
  },
  {
    key: "vibeCoderFit",
    label: "Vibe Coder",
    desc: "Value for someone who wants a more capable tool without the technical depth — accessible, does-it-for-you.",
  },
] as const;
