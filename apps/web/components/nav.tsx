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
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3 sm:gap-3">
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

/** Scoreboard mark: dot-matrix rising bars — bulbs lighting up column by column. */
function Logo() {
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-md border"
      style={{ background: "var(--surface)", borderColor: "var(--border-strong)" }}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 40 40">
        <g fill="var(--border-strong)">
          <circle cx="8" cy="14" r="3" />
          <circle cx="8" cy="23" r="3" />
          <circle cx="20" cy="14" r="3" />
        </g>
        <g fill="var(--brand)">
          <circle cx="8" cy="32" r="3" />
          <circle cx="20" cy="32" r="3" />
          <circle cx="20" cy="23" r="3" />
          <circle cx="32" cy="32" r="3" />
          <circle cx="32" cy="23" r="3" />
          <circle cx="32" cy="14" r="3" />
          <circle cx="32" cy="5" r="3" />
        </g>
      </svg>
    </span>
  );
}
