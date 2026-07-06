import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";

export async function Nav() {
  const user = await getCurrentUser();
  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur"
      style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 82%, transparent)" }}
    >
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3 sm:gap-3">
        <Link href="/" className="mr-1 flex items-center gap-2" aria-label="AIx home">
          <Logo />
          <span className="text-lg font-black tracking-tight">
            AI<span className="text-brand">x</span>
          </span>
        </Link>
        <div className="flex flex-1 items-center gap-0.5 text-sm sm:gap-1">
          <NavLink href="/">Feed</NavLink>
          <NavLink href="/directory">Directory</NavLink>
          <NavLink href="/leaderboard">Leaderboard</NavLink>
          <NavLink href="/submit">Submit</NavLink>
          {user && <NavLink href="/messages">Messages</NavLink>}
        </div>
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

/** Ember mark: a three-bar verdict gauge — the grading-rig identity in miniature. */
function Logo() {
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-md"
      style={{ background: "var(--brand)" }}
      aria-hidden
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="9" width="3" height="5" rx="1" fill="var(--brand-contrast)" />
        <rect x="6.5" y="5" width="3" height="9" rx="1" fill="var(--brand-contrast)" />
        <rect x="11" y="2" width="3" height="12" rx="1" fill="var(--brand-contrast)" />
      </svg>
    </span>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-2.5 py-1.5 font-medium text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-ink"
    >
      {children}
    </Link>
  );
}
