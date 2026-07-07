import { scoreBand } from "@aix/core";

const SEG_ON: Record<string, string> = {
  strong: "seg-on-strong",
  solid: "seg-on-solid",
  mixed: "seg-on-mixed",
  weak: "seg-on-weak",
};

/**
 * The signature readout: a ten-segment bargraph, lit by score band — every
 * 0–100 number in the product renders through this one instrument.
 */
export function SegMeter({
  score,
  size = "md",
  className = "",
}: {
  score: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const lit = Math.round(Math.min(Math.max(score, 0), 100) / 10);
  const on = SEG_ON[scoreBand(score)] ?? "seg-on-mixed";
  return (
    <div
      className={`seg-meter ${size === "sm" ? "seg-sm" : ""} ${className}`}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`seg ${i < lit ? on : ""}`} />
      ))}
    </div>
  );
}
