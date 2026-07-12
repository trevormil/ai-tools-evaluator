import type { QueuedView } from "@/lib/queue";

/**
 * "In the queue" strip (ADR-0004): submitted URLs awaiting evaluation. They
 * aren't directory items yet — no .md exists until the next scan writes one —
 * so we show a lightweight, honest placeholder derived from the URL alone.
 */
export function QueueStrip({ queued }: { queued: QueuedView[] }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="eyebrow !text-amber-600 dark:!text-amber-400">In the queue · {queued.length}</p>
      <div className="card flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
        {queued.slice(0, 8).map((q) => (
          <a
            key={q.url}
            href={q.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 text-sm hover:text-brand"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="truncate font-medium">{q.title}</span>
            <span className="data ml-auto shrink-0 text-[11px] text-faint">awaiting score…</span>
          </a>
        ))}
      </div>
      <p className="text-[11px] text-faint">
        Submitted tools are evaluated on the next scan, then join the directory with a full
        scorecard.
      </p>
    </section>
  );
}
