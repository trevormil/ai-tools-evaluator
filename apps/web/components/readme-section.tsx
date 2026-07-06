"use client";

import { useState } from "react";
import { MARKDOWN_CLASSES } from "@/lib/markdown";

/**
 * The repo's own README, collapsed to a preview with a fade — our evaluation
 * and the takes stay the page's voice; the project's voice is one click away.
 * `html` comes from the safe renderer (html:false) — no live script possible.
 */
export function ReadmeSection({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className="eyebrow mb-1">In their own words</p>
        <h2 className="text-lg font-bold tracking-tight">README</h2>
      </div>
      <div className="card relative overflow-hidden p-4 sm:p-5">
        <div
          className={`${MARKDOWN_CLASSES} ${open ? "" : "max-h-72 overflow-hidden"}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {!open && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{ background: "linear-gradient(to top, var(--surface), transparent)" }}
            aria-hidden
          />
        )}
      </div>
      <button onClick={() => setOpen(!open)} className="btn-ghost self-center" aria-expanded={open}>
        {open ? "Collapse README" : "Read the full README"}
      </button>
    </section>
  );
}
