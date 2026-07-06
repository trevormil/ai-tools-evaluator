"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Composer for sending a DM within a thread. */
export function MessageComposer({ toUserId }: { toUserId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toUserId, body }),
      });
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Failed to send");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Write a message…"
        className="input flex-1 resize-y"
      />
      <button type="submit" disabled={busy || !body.trim()} className="btn-primary">
        {busy ? "Sending…" : "Send"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
