import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, items, posts, users, scanRuns } from "@aix/db";
import { getCurrentUser } from "@/lib/auth";
import { VerdictBadge } from "@/components/verdict-badge";
import { HideButton } from "./hide-button";

export const dynamic = "force-dynamic";

function fmt(sec: number | null): string {
  if (!sec) return "—";
  return new Date(sec * 1000).toISOString().replace("T", " ").slice(0, 16);
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "mod")) notFound();

  const db = getDb();
  const recentItems = db.select().from(items).orderBy(desc(items.createdAt)).limit(20).all();
  const recentPosts = db
    .select({ post: posts, author: users })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .orderBy(desc(posts.createdAt))
    .limit(20)
    .all();
  const runs = db.select().from(scanRuns).orderBy(desc(scanRuns.startedAt)).limit(10).all();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="text-sm text-neutral-500">
          Signed in as @{user.username} ({user.role}). Moderation + scanner observability.
        </p>
      </div>

      {/* ------------------------------------------------------------- items */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent items ({recentItems.length})</h2>
        <div className="flex flex-col gap-2">
          {recentItems.map((it) => (
            <div key={it.id} className="card flex items-center gap-3 p-3 text-sm">
              <VerdictBadge verdict={it.verdict} />
              <Link href={`/item/${it.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {it.title}
              </Link>
              <span className="hidden shrink-0 text-xs text-neutral-400 sm:inline">score {it.overallScore}</span>
              {!it.published && <span className="chip shrink-0">hidden</span>}
              <HideButton type="item" id={it.id} label={it.published ? "Hide" : "Unhide"} />
            </div>
          ))}
          {recentItems.length === 0 && <p className="text-sm text-neutral-500">No items yet.</p>}
        </div>
      </section>

      {/* ------------------------------------------------------------- posts */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent posts ({recentPosts.length})</h2>
        <div className="flex flex-col gap-2">
          {recentPosts.map(({ post, author }) => (
            <div key={post.id} className="card flex items-center gap-3 p-3 text-sm">
              <span className="shrink-0 text-xs text-neutral-400">@{author.username}</span>
              <Link href={`/post/${post.id}`} className="min-w-0 flex-1 truncate hover:underline">
                {post.body.slice(0, 100)}
              </Link>
              <span className="hidden shrink-0 text-xs text-neutral-400 sm:inline">▲ {post.upvotes}</span>
              <HideButton type="post" id={post.id} label="Remove" />
            </div>
          ))}
          {recentPosts.length === 0 && <p className="text-sm text-neutral-500">No posts yet.</p>}
        </div>
      </section>

      {/* --------------------------------------------------------- scan runs */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent scan runs</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase text-neutral-500">
              <tr>
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Discovered</th>
                <th className="py-2 pr-4">Published</th>
                <th className="py-2 pr-4">Dup</th>
                <th className="py-2 pr-4">Finished</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-4 text-neutral-500">{fmt(r.startedAt)}</td>
                  <td className="py-2 pr-4">{r.source}</td>
                  <td className="py-2 pr-4">
                    <span className="chip">{r.status}</span>
                  </td>
                  <td className="py-2 pr-4">{r.discovered}</td>
                  <td className="py-2 pr-4">{r.published}</td>
                  <td className="py-2 pr-4">{r.skippedDuplicate}</td>
                  <td className="py-2 pr-4 text-neutral-500">{fmt(r.finishedAt)}</td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-neutral-500">
                    No scan runs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
