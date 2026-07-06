"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  itemId?: string;
  postId?: string;
  parentId?: string;
  signedIn: boolean;
  compact?: boolean;
  onDone?: () => void;
};

export function CommentForm({ itemId, postId, parentId, signedIn, compact, onDone }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <a href="/api/auth/github" className="text-sm text-neutral-500 underline">
        Sign in to comment
      </a>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, postId, parentId, body }),
      });
      if (res.ok) {
        setBody("");
        onDone?.();
        router.refresh();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Failed to post comment");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 2 : 3}
        placeholder={parentId ? "Write a reply…" : "Add a comment…"}
        className="input resize-y"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div>
        <button type="submit" disabled={busy || !body.trim()} className="btn-primary">
          {busy ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
      </div>
    </form>
  );
}
