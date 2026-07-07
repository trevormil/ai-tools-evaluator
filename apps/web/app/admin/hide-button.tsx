"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Minimal mod action button: POSTs to /api/admin/hide, then refreshes. */
export function HideButton({
  type,
  id,
  label,
}: {
  type: "item" | "post";
  id: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/hide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "Action failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={run} disabled={busy} className="btn-ghost !px-2 text-xs">
      {busy ? "…" : label}
    </button>
  );
}
