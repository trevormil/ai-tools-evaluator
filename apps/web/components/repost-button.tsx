"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  targetType: "post" | "item";
  targetId: string;
  initialCount?: number;
  initialReposted?: boolean;
  signedIn: boolean;
};

/**
 * Repost affordance (tickets 0019/0025): a plain toggle when already reposted;
 * otherwise a two-option choice — instant repost, or quote with a short take.
 */
export function RepostButton({
  targetType,
  targetId,
  initialCount = 0,
  initialReposted = false,
  signedIn,
}: Props) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [reposted, setReposted] = useState(initialReposted);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState("");

  async function send(withQuote?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/reposts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId, quote: withQuote || undefined }),
      });
      if (res.ok) {
        const data = (await res.json()) as { reposted: boolean; count: number };
        setReposted(data.reposted);
        setCount(data.count);
        setMenu(false);
        setQuoting(false);
        setQuote("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function onClick() {
    if (!signedIn) {
      window.location.href = "/api/auth/github";
      return;
    }
    // Already reposted → the click means "undo".
    if (reposted) {
      void send();
      return;
    }
    setMenu(!menu);
    setQuoting(false);
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        onClick={onClick}
        disabled={busy}
        className={`inline-flex items-center gap-1 hover:underline ${reposted ? "text-green-600 dark:text-green-500" : ""}`}
        aria-pressed={reposted}
        aria-expanded={menu}
      >
        <span aria-hidden>⇄</span>
        {count} {reposted ? "reposted" : "reposts"}
      </button>
      {menu && !quoting && (
        <span
          className="absolute left-0 top-6 z-30 flex flex-col overflow-hidden rounded-lg border text-left shadow-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <button
            onClick={() => void send()}
            className="px-3 py-1.5 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          >
            ⇄ Repost
          </button>
          <button
            onClick={() => setQuoting(true)}
            className="px-3 py-1.5 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          >
            ❝ Quote…
          </button>
        </span>
      )}
      {menu && quoting && (
        <span
          className="absolute left-0 top-6 z-30 flex w-64 items-center gap-1.5 rounded-lg border p-1.5 shadow-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <input
            autoFocus
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && quote.trim()) void send(quote.trim());
              if (e.key === "Escape") setMenu(false);
            }}
            placeholder="Add your take…"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-xs outline-none focus:border-[var(--brand)]"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={() => quote.trim() && void send(quote.trim())}
            disabled={busy || !quote.trim()}
            className="btn-primary !px-2.5 !py-1 text-xs disabled:opacity-50"
          >
            Quote
          </button>
        </span>
      )}
    </span>
  );
}
