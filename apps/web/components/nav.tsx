import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { NavLinks } from "./nav-links";

export async function Nav() {
  const user = await getCurrentUser();
  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--bg) 82%, transparent)",
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 sm:gap-3">
        <Link href="/" className="mr-1 flex items-center gap-2" aria-label="AIx home">
          <Logo />
          <span className="text-lg font-black tracking-tight">
            AI<span className="text-brand">x</span>
          </span>
        </Link>
        {/* <sm: the bottom tab bar (MobileNav) carries these; header stays lean. */}
        <div className="hidden flex-1 items-center gap-0.5 text-sm sm:flex sm:gap-1">
          <NavLinks signedIn={!!user} />
        </div>
        <div className="flex-1 sm:hidden" aria-hidden />
        {user && <NotificationBell />}
        <ThemeToggle />
        {user ? (
          <Link href={`/u/${user.username}`} className="btn-ghost !px-2 !py-1.5">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.username} className="h-6 w-6 rounded-full" />
            ) : (
              <span className="font-mono text-xs">@{user.username}</span>
            )}
          </Link>
        ) : (
          <a href="/api/auth/github" className="btn-primary !py-1.5">
            Sign in
          </a>
        )}
      </nav>
    </header>
  );
}

/** Signal funnel: noise filters down through three bands to a single signal dot. */
function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" fill="none" aria-hidden className="shrink-0">
      <defs>
        <linearGradient
          id="navFunnel"
          x1="16"
          y1="12"
          x2="42"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#2ad9d0" />
          <stop offset="0.5" stopColor="#2e7ff4" />
          <stop offset="1" stopColor="#2a3fe8" />
        </linearGradient>
      </defs>
      <g fill="url(#navFunnel)" stroke="url(#navFunnel)" strokeWidth="2" strokeLinejoin="round">
        <path d="M10 12 H54 L47.1 22 H16.9 Z" />
        <path d="M18.9 25 H45.1 L39.6 33 H24.4 Z" />
        <path d="M26.5 36 H37.5 L32 44 Z" />
      </g>
      <circle cx="32" cy="49" r="2.9" fill="url(#navFunnel)" />
    </svg>
  );
}
