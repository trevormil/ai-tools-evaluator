"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { renderMarkdown, MARKDOWN_CLASSES } from "@/lib/markdown";

type ExistingArticle = { slug: string; title: string; bodyMd: string };

/** Compose a new article, or edit an existing one when `article` is provided. */
export function ArticleEditor({ article }: { article?: ExistingArticle }) {
  const router = useRouter();
  const editing = !!article;
  const [title, setTitle] = useState(article?.title ?? "");
  const [bodyMd, setBodyMd] = useState(article?.bodyMd ?? "");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = editing
        ? await fetch(`/api/articles/${encodeURIComponent(article!.slug)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: title.trim(), bodyMd }),
          })
        : await fetch("/api/articles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: title.trim(), bodyMd }),
          });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Couldn't save that.");
        return;
      }
      const { article: saved } = await res.json();
      router.push(`/a/${saved.slug}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        className="input text-lg font-semibold"
        placeholder="Article title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
      />

      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className={preview ? "btn-ghost" : "btn-primary"}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={preview ? "btn-primary" : "btn-ghost"}
        >
          Preview
        </button>
        <span className="text-neutral-400">Markdown supported</span>
      </div>

      {preview ? (
        <div
          className={`card min-h-[16rem] p-4 ${MARKDOWN_CLASSES}`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(bodyMd) }}
        />
      ) : (
        <textarea
          className="input min-h-[16rem] font-mono text-sm"
          placeholder="Write your article in markdown…"
          value={bodyMd}
          onChange={(e) => setBodyMd(e.target.value)}
          required
        />
      )}

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy || !title.trim() || !bodyMd.trim()}>
          {busy ? "Saving…" : editing ? "Save changes" : "Publish article"}
        </button>
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
    </form>
  );
}
