"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STACK_STATUSES, STACK_STATUS_LABELS, type StackStatus } from "@/lib/stack-types";

/** Owner-only form to add a tool to your stack (catalogued item or free-form). */
export function StackEditor() {
  const router = useRouter();
  const [toolName, setToolName] = useState("");
  const [status, setStatus] = useState<StackStatus>("using");
  const [take, setTake] = useState("");
  const [rating, setRating] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/stack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toolName: toolName.trim(),
          status,
          take: take.trim() || undefined,
          rating: rating === "" ? undefined : Number(rating),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "Couldn't add that.");
      } else {
        setToolName("");
        setTake("");
        setRating("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="card flex flex-col gap-2 p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input flex-1" placeholder="Tool name (e.g. ripgrep)" value={toolName} onChange={(e) => setToolName(e.target.value)} required />
        <select className="input sm:w-40" value={status} onChange={(e) => setStatus(e.target.value as StackStatus)}>
          {STACK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STACK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="input sm:w-24" value={rating} onChange={(e) => setRating(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">★ —</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </select>
      </div>
      <textarea className="input" rows={2} placeholder="Your take — why you run it, or why you dropped it" value={take} onChange={(e) => setTake(e.target.value)} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy || !toolName.trim()}>
          {busy ? "Adding…" : "Add to stack"}
        </button>
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
    </form>
  );
}

/** Owner-only remove button for a stack entry. */
export function StackDeleteButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  async function remove() {
    await fetch("/api/stack", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: entryId }) });
    router.refresh();
  }
  return (
    <button onClick={remove} className="ml-auto text-xs text-neutral-400 hover:text-red-500" title="Remove">
      ✕
    </button>
  );
}
