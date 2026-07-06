"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  targetType: "item" | "post" | "comment";
  targetId: string;
  initialNet: number;
  initialVote?: number; // -1 | 0 | 1
  signedIn: boolean;
};

export function VoteButtons({ targetType, targetId, initialNet, initialVote = 0, signedIn }: Props) {
  const router = useRouter();
  const [net, setNet] = useState(initialNet);
  const [vote, setVote] = useState(initialVote);
  const [busy, setBusy] = useState(false);

  async function cast(value: 1 | -1) {
    if (!signedIn) {
      window.location.href = "/api/auth/github";
      return;
    }
    if (busy) return;
    setBusy(true);
    // Optimistic: toggling the same value clears it.
    const nextVote = vote === value ? 0 : value;
    setNet(net - vote + nextVote);
    setVote(nextVote);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId, value }),
      });
      if (res.ok) {
        const data = (await res.json()) as { net: number; value: number };
        setNet(data.net);
        setVote(data.value);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => cast(1)}
        className={`px-1 text-lg leading-none transition-colors ${vote === 1 ? "text-orange-500" : "text-neutral-400 hover:text-orange-500"}`}
        aria-label="Upvote"
      >
        ▲
      </button>
      <span className="text-xs font-semibold tabular-nums">{net}</span>
      <button
        onClick={() => cast(-1)}
        className={`px-1 text-lg leading-none transition-colors ${vote === -1 ? "text-blue-500" : "text-neutral-400 hover:text-blue-500"}`}
        aria-label="Downvote"
      >
        ▼
      </button>
    </div>
  );
}
