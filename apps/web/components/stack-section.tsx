import Link from "next/link";
import { type StackEntry, STACK_STATUSES, STACK_STATUS_LABELS, stackEntryName } from "@/lib/stack";
import { VerdictBadge } from "@/components/verdict-badge";
import { StackEditor, StackDeleteButton } from "@/components/stack-editor";

/**
 * Read-only "My Stack" view, grouped by status; editor shown to the owner.
 * `messageHref` (signed-in visitors) adds an "ask about this" DM affordance
 * per entry — ticket 0019's "ask about their stack", shipped via 0029.
 */
export function StackSection({
  stack,
  isSelf,
  username,
  messageHref,
}: {
  stack: StackEntry[];
  isSelf: boolean;
  username: string;
  messageHref?: string;
}) {
  const grouped = STACK_STATUSES.map((status) => ({
    status,
    entries: stack.filter((e) => e.status === status),
  })).filter((g) => g.entries.length > 0);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isSelf ? "My Stack" : `${username}'s Stack`}</h2>
      </div>

      {isSelf && <StackEditor />}

      {stack.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {isSelf
            ? "Add the tools you actually run and your honest take on each."
            : "No tools in this stack yet."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {grouped.map((g) => (
            <div key={g.status}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {STACK_STATUS_LABELS[g.status]}
              </h3>
              <ul className="flex flex-col gap-2">
                {g.entries.map((e) => (
                  <li key={e.id} className="card flex flex-col gap-1 p-3">
                    <div className="flex items-center gap-2">
                      {e.item ? (
                        <Link href={`/item/${e.item.slug}`} className="font-medium hover:underline">
                          {e.item.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{stackEntryName(e)}</span>
                      )}
                      {e.item && <VerdictBadge verdict={e.item.verdict} />}
                      {e.rating != null && <span className="chip">{"★".repeat(e.rating)}</span>}
                      {isSelf && <StackDeleteButton entryId={e.id} />}
                      {!isSelf && messageHref && (
                        <a
                          href={messageHref}
                          className="ml-auto shrink-0 text-xs text-muted hover:text-brand hover:underline"
                        >
                          ask about this →
                        </a>
                      )}
                    </div>
                    {e.take && (
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">{e.take}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
