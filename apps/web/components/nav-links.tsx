"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Desktop header links with a real active state (polish pass). */
export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  // Two surfaces: the Feed (today's pick + activity, home) and the searchable
  // Directory. `signedIn` no longer changes the nav.
  void signedIn;
  const links: { href: string; label: string; active: boolean }[] = [
    { href: "/", label: "Feed", active: pathname === "/" || pathname.startsWith("/item") },
    { href: "/directory", label: "Directory", active: pathname.startsWith("/directory") },
    { href: "/submit", label: "Submit", active: pathname.startsWith("/submit") },
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
