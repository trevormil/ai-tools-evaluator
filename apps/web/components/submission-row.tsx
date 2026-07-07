import type { Submission } from "@aix/db";

/** Colored status per outcome so a rejected submission reads at a glance. */
const STATUS_CLS: Record<string, string> = {
  published: "!text-green-600 dark:!text-green-500",
  duplicate: "!text-amber-600 dark:!text-amber-500",
  rejected: "!text-red-600 dark:!text-red-500",
  failed: "!text-red-600 dark:!text-red-500",
};

/**
 * One submission with its outcome AND the why (ticket 0028) — the reason was
 * always in the DB; now the submitter actually sees it.
 */
export function SubmissionRow({ submission: s }: { submission: Submission }) {
  return (
    <li className="card flex flex-col gap-1 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate">{s.url}</span>
        <span className={`chip shrink-0 ${STATUS_CLS[s.status] ?? ""}`}>{s.status}</span>
      </div>
      {s.reason && <p className="text-xs text-muted">{s.reason}</p>}
    </li>
  );
}
