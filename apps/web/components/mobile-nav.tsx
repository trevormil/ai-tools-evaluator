"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Fixed bottom tab bar for phones (ticket 0030) — thumb-reach navigation for
 * the feed-first mobile experience. Hidden ≥sm, where the header nav shows.
 */
export function MobileNav({ username }: { username: string | null }) {
  const pathname = usePathname();

  const tabs: { href: string; label: string; icon: string; active: boolean }[] = [
    { href: "/", label: "Feed", icon: "⌂", active: pathname === "/" },
    {
      href: "/directory",
      label: "Directory",
      icon: "▤",
      active: pathname.startsWith("/directory") || pathname.startsWith("/item"),
    },
    { href: "/submit", label: "Submit", icon: "＋", active: pathname.startsWith("/submit") },
    {
      href: username ? "/notifications" : "/api/auth/github",
      label: "Alerts",
      icon: "◔",
      active: pathname.startsWith("/notifications"),
    },
    {
      href: username ? `/u/${username}` : "/api/auth/github",
      label: username ? "Profile" : "Sign in",
      icon: "◉",
      active: username ? pathname.startsWith(`/u/${username}`) : false,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--bg) 88%, transparent)",
      }}
    >
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
            t.active ? "text-brand" : "text-muted"
          }`}
        >
          <span aria-hidden className="text-base leading-none">
            {t.icon}
          </span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
