"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Desktop header links with a real active state. */
export function NavLinks() {
  const pathname = usePathname();

  const links: { href: string; label: string; active: boolean }[] = [
    {
      href: "/",
      label: "Directory",
      active: pathname === "/" || pathname.startsWith("/item"),
    },
    { href: "/leaderboard", label: "Leaderboard", active: pathname.startsWith("/leaderboard") },
    { href: "/recap", label: "Recap", active: pathname.startsWith("/recap") },
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
