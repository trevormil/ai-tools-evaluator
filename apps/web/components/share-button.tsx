"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Absolute permalink to the item — unfurls into the rich card in chats. */
  url: string;
  /** One-line judgment used as the X tweet text. */
  blurb: string;
  /** Multi-line scorecard blurb for pasting into Discord/Slack. */
  summary: string;
};

/**
 * Share affordance for an item: copy the link (unfurls to a rich card via OG
 * tags), copy a scorecard summary for chats, or fire an X intent. Closes on
 * outside-click / Escape like a normal menu.
 */
export function ShareButton({ url, blurb, summary }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "summary" | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(text: string, which: "link" | "summary") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable (http/permissions) — nothing to do */
    }
  }

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(blurb)}&url=${encodeURIComponent(url)}`;

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 hover:underline"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span aria-hidden>↗</span>
        Share
      </button>
      {open && (
        <span
          role="menu"
          className="absolute left-0 top-6 z-30 flex w-52 flex-col overflow-hidden rounded-lg border text-left shadow-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <button
            role="menuitem"
            onClick={() => copy(url, "link")}
            className="px-3 py-1.5 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          >
            {copied === "link" ? "Link copied ✓" : "🔗 Copy link"}
          </button>
          <button
            role="menuitem"
            onClick={() => copy(summary, "summary")}
            className="px-3 py-1.5 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          >
            {copied === "summary" ? "Summary copied ✓" : "📋 Copy summary + link"}
          </button>
          <a
            role="menuitem"
            href={xHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          >
            𝕏 Share on X
          </a>
        </span>
      )}
    </span>
  );
}
