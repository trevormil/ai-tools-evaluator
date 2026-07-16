"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Rescore (ticket: item-rescore): ask for an already-scored item to be
 * re-evaluated. Once per item per week — the button reflects the three states
 * the server computed: eligible (click to queue), pending (already in flight),
 * or cooling down (disabled until `nextEligibleAt`).
 */
export function RescoreButton({
  slug,
  signedIn,
  pending: initialPending,
  eligible,
  nextEligibleAt,
}: {
  slug: string;
  signedIn: boolean;
  pending: boolean;
  eligible: boolean;
  nextEligibleAt: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(initialPending);
  const [msg, setMsg] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(
    eligible ? null : nextEligibleAt,
  );

  // A rescore is in flight — nothing to do but wait for the next scan.
  if (pending) {
    return (
      <span className="chip text-xs !border-amber-500 !text-amber-600 dark:!text-amber-400">
        Re-evaluating…
      </span>
    );
  }

  const daysLeft =
    cooldownUntil != null
      ? Math.max(1, Math.ceil((cooldownUntil - Math.floor(Date.now() / 1000)) / 86_400))
      : 0;
  const onCooldown = cooldownUntil != null && daysLeft > 0;

  async function rescore() {
    if (!signedIn) {
      window.location.href = "/api/auth/github";
      return;
    }
    if (busy || onCooldown) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/rescore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        nextEligibleAt?: number;
      };
      if (res.ok) {
        setPending(true);
        setMsg("Queued — a fresh evaluation lands on the next scan.");
        router.refresh();
      } else {
        if (data.nextEligibleAt) setCooldownUntil(data.nextEligibleAt);
        setMsg(data.error ?? "Couldn't queue a rescore.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={rescore}
        disabled={busy || onCooldown}
        title={
          onCooldown
            ? `Rescore available in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
            : "Re-evaluate this tool (once per week)"
        }
        className="link-brand font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Queuing…" : onCooldown ? `Rescore in ${daysLeft}d` : "↻ Rescore"}
      </button>
      {msg && <span className="text-[11px] text-muted">{msg}</span>}
    </span>
  );
}
