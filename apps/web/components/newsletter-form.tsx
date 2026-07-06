"use client";

import { useState } from "react";

/** Email capture for the nightly recap. Double opt-in — posts, then user confirms. */
export function NewsletterForm({ variant = "card" }: { variant?: "card" | "inline" }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMsg(
        res.ok
          ? (data.message ?? "Check your inbox to confirm.")
          : (data.error ?? "Something went wrong."),
      );
      if (res.ok) setEmail("");
    } catch {
      setMsg("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  // `inline` drops the card chrome/heading for surfaces that already frame it
  // (the recap hero + recap page). `card` is the standalone default.
  const formRow = (
    <>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@dev.com"
          className="input flex-1"
        />
        <button type="submit" disabled={busy} className="btn-primary whitespace-nowrap">
          {busy ? "…" : "Subscribe"}
        </button>
      </form>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </>
  );

  if (variant === "inline") return <div>{formRow}</div>;

  return (
    <div className="card p-4">
      <h3 className="font-semibold">The nightly recap</h3>
      <p className="mt-1 text-sm text-muted">
        One email a night — the tools judged, the traps named.
      </p>
      <div className="mt-3">{formRow}</div>
    </div>
  );
}
