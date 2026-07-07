import Link from "next/link";
import type { FeedMode } from "@/lib/home-feed";

/** Explicit Everything/Following switch — URL-driven, no magic fallback (ticket 0024). */
export function FeedTabs({ mode }: { mode: FeedMode }) {
  return (
    <div
      className="flex w-fit items-center gap-1 rounded-xl border p-1"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <Tab href="/?feed=all" active={mode === "all"}>
        Everything
      </Tab>
      <Tab href="/?feed=following" active={mode === "following"}>
        Following
      </Tab>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
        active ? "bg-[var(--surface-2)] text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
