import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";

export async function Nav() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3 sm:gap-3">
        <Link href="/" className="mr-1 text-lg font-bold tracking-tight">
          AI<span className="text-orange-500">x</span>
        </Link>
        <div className="flex flex-1 items-center gap-1 text-sm sm:gap-2">
          <NavLink href="/">Feed</NavLink>
          <NavLink href="/directory">Directory</NavLink>
          <NavLink href="/leaderboard">Leaderboard</NavLink>
          <NavLink href="/submit">Submit</NavLink>
          {user && <NavLink href="/messages">Messages</NavLink>}
        </div>
        {user && <NotificationBell />}
        <ThemeToggle />
        {user ? (
          <Link href={`/u/${user.username}`} className="btn-ghost !px-2">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.username} className="h-6 w-6 rounded-full" />
            ) : (
              <span>@{user.username}</span>
            )}
          </Link>
        ) : (
          <a href="/api/auth/github" className="btn-primary">
            Sign in
          </a>
        )}
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-lg px-2 py-1 font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white">
      {children}
    </Link>
  );
}
