"use client";

import { useState, type ReactNode } from "react";

export type ProfileTab = { key: string; label: string; content: ReactNode };

/**
 * Client-side tabs over server-rendered content. Deep-linkable (ticket 0029):
 * `initialTab` comes from the page's ?tab= param and switching updates the URL
 * via replaceState so any tab is shareable without a re-render round-trip.
 */
export function ProfileTabs({ tabs, initialTab }: { tabs: ProfileTab[]; initialTab?: string }) {
  const valid = tabs.some((t) => t.key === initialTab);
  const [active, setActive] = useState(valid ? initialTab : tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  function select(key: string) {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => select(t.key)}
            className={`-mb-px whitespace-nowrap px-4 py-2 text-sm font-semibold transition-colors ${
              t.key === current?.key
                ? "border-b-2 border-[var(--brand)] text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}
