"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FollowButton({
  targetUserId,
  initialFollowing,
  signedIn,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      window.location.href = "/api/auth/github";
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { following: boolean };
        setFollowing(data.following);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={toggle} disabled={busy} className={following ? "btn-ghost" : "btn-primary"}>
      {following ? "Following" : "Follow"}
    </button>
  );
}
