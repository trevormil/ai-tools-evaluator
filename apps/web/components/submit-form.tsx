"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, note }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        duplicate?: boolean;
        submission?: { reason?: string | null };
        item?: { slug: string; title: string };
      };
      if (res.ok) {
        setUrl("");
        setNote("");
        // The tool is live immediately (ticket 0035) — take them to it.
        if (!data.duplicate && data.item) {
          router.push(`/item/${data.item.slug}`);
          return;
        }
        setMsg({
          ok: true,
          text: data.duplicate
            ? (data.submission?.reason ?? "Already known — thanks!")
            : "Queued! The evaluator runs every ~5 minutes — it'll be scored shortly.",
        });
        router.refresh();
      } else {
        setMsg({ ok: false, text: data.error ?? "Failed to submit" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <label className="text-sm font-medium">Repo / paper / link URL</label>
      <input
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/owner/repo"
        className="input"
      />
      <label className="text-sm font-medium">Note (optional)</label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Why is this worth evaluating?"
        className="input resize-y"
      />
      {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
      <div>
        <button type="submit" disabled={busy || !url.trim()} className="btn-primary">
          {busy ? "Submitting…" : "Submit to queue"}
        </button>
      </div>
    </form>
  );
}
