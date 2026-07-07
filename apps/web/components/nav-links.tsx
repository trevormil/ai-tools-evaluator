"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Desktop header links with a real active state (polish pass). */
export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  // Recap-first product (ticket 0040): the nightly briefing + the directory are
  // the spine. Feed-social (activity, messages) is dropped from the surface;
  // its routes still exist. `signedIn` no longer changes the nav.
  void signedIn;
  const links: { href: string; label: string; active: boolean }[] = [
    { href: "/", label: "Directory", active: pathname === "/" || pathname.startsWith("/item") },
    { href: "/recap", label: "Recap", active: pathname.startsWith("/recap") },
    { href: "/leaderboard", label: "Leaderboard", active: pathname.startsWith("/leaderboard") },
    { href: "/submit", label: "Submit", active: pathname.startsWith("/submit") },
    { href: "/random", label: "Random", active: false },
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
