"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Owner-only "delete this article" button. Refreshes in place, or navigates to
 * `redirectTo` (used on the article page itself, which would otherwise 404).
 */
export function ArticleDeleteControl({ slug, redirectTo }: { slug: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this article?")) return;
    setBusy(true);
    const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`, { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <button onClick={remove} disabled={busy} className="text-neutral-400 hover:text-red-500" title="Delete">
      Delete
    </button>
  );
}
