"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STACK_STATUSES, STACK_STATUS_LABELS, type StackStatus } from "@/lib/stack-types";

/**
 * Add/edit YOUR take on a tool (ticket 0036) — upserts the stack entry via
 * /api/stack, so a take and "I use this" are one object.
 */
export function TakeComposer({
  itemId,
  initialTake,
  initialStatus,
  initialRating,
  signedIn,
}: {
  itemId: string;
  initialTake: string | null;
  initialStatus: StackStatus | null;
  initialRating: number | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const hasTake = !!initialTake;
  const [open, setOpen] = useState(false);
  const [take, setTake] = useState(initialTake ?? "");
  const [status, setStatus] = useState<StackStatus>(initialStatus ?? "using");
  const [rating, setRating] = useState<number | null>(initialRating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div className="card p-4 text-sm text-neutral-500">
        <a href="/api/auth/github" className="underline">
          Sign in
        </a>{" "}
        to add your take.
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={hasTake ? "btn-ghost" : "btn-primary"}>
        {hasTake ? "Edit your take" : "Add your take"}
      </button>
    );
  }

  async function submit() {
    const text = take.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, status, take: text, rating: rating ?? undefined }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Failed to save your take");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-2 p-4">
      <textarea
        autoFocus
        value={take}
        onChange={(e) => setTake(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="How do you use it? What's your honest read?"
        className="input resize-y"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input !w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value as StackStatus)}
          aria-label="Status"
        >
          {STACK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STACK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="input !w-auto"
          value={rating ?? ""}
          onChange={(e) => setRating(e.target.value ? Number(e.target.value) : null)}
          aria-label="Rating"
        >
          <option value="">No rating</option>
          {[1, 2, 3, 4, 5].map((r) => (
            <option key={r} value={r}>
              {"★".repeat(r)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setOpen(false)} className="btn-ghost !py-1.5">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !take.trim()}
            className="btn-primary !py-1.5 disabled:opacity-50"
          >
            {busy ? "Saving…" : hasTake ? "Update take" : "Post take"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
