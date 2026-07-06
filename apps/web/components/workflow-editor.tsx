"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ArticleOption = { id: string; title: string };
type Mode = "none" | "url" | "article";

/** Owner-only editor for "My Workflow": an external link OR one of your articles. */
export function WorkflowEditor({
  articles,
  currentUrl,
  currentArticleId,
}: {
  articles: ArticleOption[];
  currentUrl: string | null;
  currentArticleId: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(
    currentArticleId ? "article" : currentUrl ? "url" : "none",
  );
  const [url, setUrl] = useState(currentUrl ?? "");
  const [articleId, setArticleId] = useState(currentArticleId ?? articles[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload =
      mode === "url"
        ? { url: url.trim() }
        : mode === "article"
          ? { articleId }
          : { url: null, articleId: null };
    try {
      const res = await fetch("/api/workflow", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Couldn't save that.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost w-fit text-sm">
        Edit my workflow
      </button>
    );
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input type="radio" checked={mode === "none"} onChange={() => setMode("none")} /> None
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={mode === "url"} onChange={() => setMode("url")} /> External
          link
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "article"}
            onChange={() => setMode("article")}
            disabled={articles.length === 0}
          />{" "}
          One of my articles
        </label>
      </div>

      {mode === "url" && (
        <input
          className="input"
          type="url"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      )}

      {mode === "article" && (
        <select className="input" value={articleId} onChange={(e) => setArticleId(e.target.value)}>
          {articles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      )}
      {mode === "article" && articles.length === 0 && (
        <p className="text-xs text-neutral-500">
          Write an article first to feature it as your workflow.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Cancel
        </button>
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
    </form>
  );
}
