"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Desktop header links with a real active state (polish pass). */
export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  const links: { href: string; label: string; active: boolean }[] = [
    { href: "/", label: "Directory", active: pathname === "/" || pathname.startsWith("/item") },
    { href: "/activity", label: "Activity", active: pathname.startsWith("/activity") },
    { href: "/leaderboard", label: "Leaderboard", active: pathname.startsWith("/leaderboard") },
    { href: "/submit", label: "Submit", active: pathname.startsWith("/submit") },
    { href: "/random", label: "Random", active: false },
    ...(signedIn
      ? [{ href: "/messages", label: "Messages", active: pathname.startsWith("/messages") }]
      : []),
  ];

  return (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
            l.active
              ? "bg-[var(--surface-2)] text-ink"
              : "text-muted hover:bg-[var(--surface-2)] hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}
