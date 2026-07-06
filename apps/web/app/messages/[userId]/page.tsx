import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, users } from "@aix/db";
import { getCurrentUser } from "@/lib/auth";
import { getThread, markThreadRead } from "@/lib/messages";
import { timeAgo } from "@/lib/format";
import { MessageComposer } from "@/components/message-composer";

export const dynamic = "force-dynamic";

type Params = Promise<{ userId: string }>;

export default async function ThreadPage({ params }: { params: Params }) {
  const me = await getCurrentUser();
  if (!me) redirect("/api/auth/github");
  const { userId } = await params;

  const other = getDb().select().from(users).where(eq(users.id, userId)).get();
  if (!other) notFound();

  const messages = getThread(me.id, other.id);
  markThreadRead(me.id, other.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/messages" className="text-sm text-neutral-500 hover:underline">
          ← Messages
        </Link>
        <Link
          href={`/u/${other.username}`}
          className="ml-auto flex items-center gap-2 font-medium hover:underline"
        >
          {other.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={other.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
          )}
          @{other.username}
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="card p-8 text-center text-sm text-neutral-500">
            No messages yet. Say hello.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.fromUserId === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`mt-0.5 text-[10px] ${mine ? "text-orange-100" : "text-neutral-400"}`}
                  >
                    {timeAgo(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card p-3">
        <MessageComposer toUserId={other.id} />
      </div>
    </div>
  );
}
