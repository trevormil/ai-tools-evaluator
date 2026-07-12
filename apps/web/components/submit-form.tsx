"use client";

import { useState } from "react";

/**
 * Submit a tool URL. Static site (ADR-0004): this POSTs to the Cloudflare
 * submission Worker (NEXT_PUBLIC_SUBMIT_URL), which appends a file to
 * content/queue/. The next scan evaluates it and it joins the directory.
 */
type State = { kind: "idle" | "sending" } | { kind: "ok" } | { kind: "error"; message: string };

export function SubmitForm() {
  const endpoint = process.env.NEXT_PUBLIC_SUBMIT_URL;
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!endpoint) return;
    setState({ kind: "sending" });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, note: note || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState({ kind: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      setState({ kind: "ok" });
      setUrl("");
      setNote("");
    } catch {
      setState({ kind: "error", message: "Network error — try again." });
    }
  }

  if (!endpoint) {
    return (
      <div className="card p-6 text-sm text-muted">
        Submissions aren&apos;t configured on this deployment yet.
      </div>
    );
  }

  if (state.kind === "ok") {
    return (
      <div className="card border-dashed p-6 text-sm">
        <p className="eyebrow mb-1 !text-[var(--band-strong)]">Queued</p>
        Thanks — it&apos;s in the queue and will be evaluated on the next scan, then join the
        directory with a full scorecard.
        <button className="btn-ghost mt-4" onClick={() => setState({ kind: "idle" })}>
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-3 p-5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="data text-[11px] uppercase tracking-wider text-faint">
          GitHub repo URL
        </span>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="rounded-lg border bg-transparent px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="data text-[11px] uppercase tracking-wider text-faint">
          Note (optional)
        </span>
        <input
          type="text"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why is it worth a look?"
          className="rounded-lg border bg-transparent px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      {state.kind === "error" && <p className="text-sm text-[var(--band-weak)]">{state.message}</p>}
      <button type="submit" className="btn-primary self-start" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Submitting…" : "Submit for evaluation"}
      </button>
    </form>
  );
}
