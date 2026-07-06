"use client";

import { useState } from "react";

/** Copy-to-clipboard with a quiet confirmation — for install one-liners. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable (http/permissions) — nothing to do */
        }
      }}
      className={`data shrink-0 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
        copied ? "text-brand" : "text-faint hover:text-ink"
      }`}
      aria-label={`${label} to clipboard`}
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}
