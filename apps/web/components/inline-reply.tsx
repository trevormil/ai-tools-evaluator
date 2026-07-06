"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Reply without leaving the timeline (ticket 0025): expands a one-line composer
 * in place and posts to /api/comments. Depth (the full thread) stays one tap
 * away on the target page.
 */
export function InlineReply({
  postId,
  itemId,
  signedIn,
}: {
  postId?: string;
  itemId?: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function toggle() {
    if (!signedIn) {
      window.location.href = "/api/auth/github";
      return;
    }
    setOpen(!open);
  }

  async function submit() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(postId ? { postId, body: text } : { itemId, body: text }),
      });
      if (res.ok) {
        setBody("");
        setOpen(false);
        setSent(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={toggle} className="hover:underline" aria-expanded={open}>
        Reply
      </button>
      {sent && !open && <span className="text-green-600 dark:text-green-500">replied ✓</span>}
      {open && (
        <span className="mt-2 flex w-full basis-full items-center gap-2">
          <input
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Write a reply…"
            maxLength={4000}
            className="min-w-0 flex-1 rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--brand)]"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={submit}
            disabled={busy || !body.trim()}
            className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-50"
          >
            Reply
          </button>
        </span>
      )}
    </>
  );
}
