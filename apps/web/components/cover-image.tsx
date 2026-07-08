"use client";

import { useState } from "react";
import { coverImageCandidates, type CoverInput } from "@/lib/cover";

/**
 * Square item thumbnail with a load-failure cascade: tries the stored cover,
 * then always-square GitHub fallbacks (owner avatar, social card), then a
 * placeholder. Guarantees every item renders at least one sensible square image
 * even when the stored cover 404s or crops badly.
 */
export function CoverImage({ item, className }: { item: CoverInput; className?: string }) {
  const candidates = coverImageCandidates(item);
  const [idx, setIdx] = useState(0);
  const src = candidates[Math.min(idx, candidates.length - 1)];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      style={{ background: "var(--surface-2)" }}
      onError={() => setIdx((i) => Math.min(i + 1, candidates.length - 1))}
    />
  );
}
