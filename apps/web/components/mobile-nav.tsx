"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Fixed bottom tab bar for phones — thumb-reach navigation for the
 * directory-first mobile experience. Hidden ≥sm, where the header nav shows.
 */
export function MobileNav() {
  const pathname = usePathname();

  const tabs: { href: string; label: string; icon: string; active: boolean }[] = [
    {
      href: "/",
      label: "Directory",
      icon: "▤",
      active: pathname === "/" || pathname.startsWith("/item"),
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: "≜",
      active: pathname.startsWith("/leaderboard"),
    },
    { href: "/recap", label: "Recap", icon: "≋", active: pathname.startsWith("/recap") },
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
