import { eq } from "drizzle-orm";
import { getDb, subscribers } from "@aix/db";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** One-click unsubscribe from the emailed token link. */
export default async function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  const token = (await searchParams).token;
  const t = Array.isArray(token) ? token[0] : token;

  let ok = false;
  if (t) {
    const db = getDb();
    const sub = db.select().from(subscribers).where(eq(subscribers.token, t)).get();
    if (sub) {
      db.update(subscribers)
        .set({ status: "unsubscribed", unsubscribedAt: Math.floor(Date.now() / 1000) })
        .where(eq(subscribers.id, sub.id))
        .run();
      ok = true;
    }
  }

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold">{ok ? "Unsubscribed" : "Invalid link"}</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        {ok
          ? "You won't receive the AIx digest anymore. You can re-subscribe any time."
          : "This unsubscribe link isn't valid."}
      </p>
      <a
        href="/"
        className="mt-6 inline-block text-orange-600 hover:underline dark:text-orange-400"
      >
        ← Back to AIx
      </a>
    </div>
  );
}
