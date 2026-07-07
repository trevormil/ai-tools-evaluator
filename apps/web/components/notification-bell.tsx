"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Bell in the nav showing the signed-in user's unread notification count. */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unread: number };
        if (alive) setUnread(data.unread);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative rounded-lg px-2 py-1 text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-ink"
      aria-label="Notifications"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span
          className="data absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
          style={{ background: "var(--brand)" }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
