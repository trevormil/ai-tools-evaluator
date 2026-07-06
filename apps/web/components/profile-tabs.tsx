"use client";

import { useState, type ReactNode } from "react";

export type ProfileTab = { key: string; label: string; content: ReactNode };

/** Simple client-side tabs; server-rendered content is passed in per tab. */
export function ProfileTabs({ tabs }: { tabs: ProfileTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
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
