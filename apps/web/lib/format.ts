/** Pure formatting helpers — safe in both server and client components. */

export function timeAgo(unixSec: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSec);
  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [30, "d"],
    [12, "mo"],
    [Number.POSITIVE_INFINITY, "y"],
  ];
  let value = diff;
  let unit = "s";
  let prev = 1;
  for (const [size, label] of units) {
    if (value < size) {
      unit = label;
      break;
    }
    prev *= size;
    value = Math.floor(diff / prev);
    unit = label;
  }
  return `${value}${unit}`;
}

export function scoreColorClass(band: "strong" | "solid" | "mixed" | "weak"): string {
  return {
    strong: "bg-green-500",
    solid: "bg-lime-500",
    mixed: "bg-amber-500",
    weak: "bg-red-500",
  }[band];
}
