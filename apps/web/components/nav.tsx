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
        <a
          href="https://discord.gg/Xc2yyrwDv"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg px-2 py-1 text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-[#5865F2]"
          aria-label="Join the AIx Discord"
          title="Join the Discord"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20.317 4.369A19.79 19.79 0 0016.558 3.2a.074.074 0 00-.079.037c-.34.607-.717 1.4-.98 2.02a18.27 18.27 0 00-5.487 0 12.6 12.6 0 00-.997-2.02.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C1.144 8.09.532 11.71.833 15.284a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.009c.12.099.246.198.373.292a.077.077 0 01-.006.127c-.598.35-1.22.645-1.873.892a.076.076 0 00-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.055c.5-4.154-.838-7.741-3.549-10.939a.06.06 0 00-.031-.028zM8.02 13.05c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.955 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z" />
          </svg>
        </a>
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
