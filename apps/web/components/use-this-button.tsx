"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * One-tap "I use this" (ticket 0033). Toggling on upserts the stack entry to
 * status=using (preserving any take); toggling off deletes a take-less entry,
 * or downgrades to "dropped" when a take exists (never destroys a take).
 */
export function UseThisButton({
  itemId,
  initialUsing,
  initialEntryId,
  initialHasTake,
  initialCount,
  signedIn,
}: {
  itemId: string;
  initialUsing: boolean;
  initialEntryId: string | null;
  initialHasTake: boolean;
  initialCount: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [using, setUsing] = useState(initialUsing);
  const [entryId, setEntryId] = useState(initialEntryId);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      window.location.href = "/api/auth/github";
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (!using) {
        const res = await fetch("/api/stack", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ itemId, status: "using" }),
        });
        if (res.ok) {
          const d = (await res.json()) as { entry: { id: string } };
          setEntryId(d.entry.id);
          setUsing(true);
          setCount(count + 1);
          router.refresh();
        }
      } else if (initialHasTake) {
        // Keep the take; just stop claiming daily use.
        const res = await fetch("/api/stack", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ itemId, status: "dropped" }),
        });
        if (res.ok) {
          setUsing(false);
          setCount(Math.max(0, count - 1));
          router.refresh();
        }
      } else if (entryId) {
        const res = await fetch("/api/stack", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: entryId }),
        });
        if (res.ok) {
          setUsing(false);
          setEntryId(null);
          setCount(Math.max(0, count - 1));
          router.refresh();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={using}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        using
          ? "border-[var(--brand)] text-brand"
          : "text-muted hover:border-[var(--brand)] hover:text-brand"
      }`}
      style={{ borderColor: using ? undefined : "var(--border)" }}
    >
      <span aria-hidden>{using ? "✓" : "+"}</span>I use this
      <span className="data text-xs">{count}</span>
    </button>
  );
}
