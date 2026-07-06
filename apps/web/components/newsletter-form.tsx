"use client";

import { useState } from "react";

/** Email capture for the daily digest. Double opt-in — posts, then user confirms. */
export function NewsletterForm() {
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
      setMsg(res.ok ? (data.message ?? "Check your inbox to confirm.") : (data.error ?? "Something went wrong."));
      if (res.ok) setEmail("");
    } catch {
      setMsg("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold">Daily digest</h3>
      <p className="mt-1 text-sm text-neutral-500">New tools & papers, each with a harsh verdict — one email a day.</p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
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
      {msg && <p className="mt-2 text-xs text-neutral-500">{msg}</p>}
    </div>
  );
}
