"use client";

import { useEffect, useState, type ReactNode } from "react";

export type ContentTab = { key: string; label: string; content: ReactNode };

/**
 * Horizontal content tabs over server-rendered panes — used by profiles and
 * item pages so long surfaces don't stack into one endless scroll. Deep-
 * linkable: the initial tab is read from the ?tab= param client-side (after
 * hydration, so static export stays valid) and switching updates the URL via
 * replaceState, so any tab is shareable.
 */
export function ContentTabs({ tabs }: { tabs: ContentTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  // Read ?tab= on mount so a shared deep link opens the right pane. Runs after
  // the static HTML hydrates (first render matches the server), so no mismatch.
  useEffect(() => {
    const key = new URL(window.location.href).searchParams.get("tab");
    if (key && tabs.some((t) => t.key === key)) setActive(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  function select(key: string) {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="sticky top-[57px] z-10 -mx-1 flex gap-1 overflow-x-auto overflow-y-hidden border-b px-1 backdrop-blur"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--bg) 88%, transparent)",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => select(t.key)}
            aria-selected={t.key === current?.key}
            role="tab"
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
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}

/** Back-compat aliases — the profile page predates the generic name. */
export { ContentTabs as ProfileTabs };
export type { ContentTab as ProfileTab };
