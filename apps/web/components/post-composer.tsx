"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Compose a new post, optionally attached to an item (by id). */
export function PostComposer({ signedIn, itemId, itemTitle }: { signedIn: boolean; itemId?: string; itemTitle?: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div className="card p-4 text-sm text-neutral-500">
        <a href="/api/auth/github" className="underline">
          Sign in with GitHub
        </a>{" "}
        to post.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, itemId }),
      });
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Failed to post");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-2 p-4">
      {itemTitle && <p className="text-xs text-neutral-500">Posting about <span className="font-medium">{itemTitle}</span></p>}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="What's happening in AI tooling?"
        className="input resize-y"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={busy || !body.trim()} className="btn-primary">
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
