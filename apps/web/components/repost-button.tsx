"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  targetType: "post" | "item";
  targetId: string;
  initialCount?: number;
  initialReposted?: boolean;
  signedIn: boolean;
};

/** Toggle a repost of a post|item; shows the live repost count. */
export function RepostButton({ targetType, targetId, initialCount = 0, initialReposted = false, signedIn }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [reposted, setReposted] = useState(initialReposted);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      window.location.href = "/api/auth/github";
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/reposts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { reposted: boolean; count: number };
        setReposted(data.reposted);
        setCount(data.count);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1 hover:underline ${reposted ? "text-green-600 dark:text-green-500" : ""}`}
      aria-pressed={reposted}
    >
      <span aria-hidden>⇄</span>
      {count} {reposted ? "reposted" : "reposts"}
    </button>
  );
}
