import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listConversations } from "@/lib/messages";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/github");

  const conversations = listConversations(user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Messages</h1>
      {conversations.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-500">
          No conversations yet. Open someone&apos;s profile and hit Message to start one.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map((c) => (
            <Link
              key={c.correspondent.id}
              href={`/messages/${c.correspondent.id}`}
              className="card flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            >
              {c.correspondent.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.correspondent.avatarUrl} alt="" className="h-9 w-9 rounded-full" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-xs dark:bg-neutral-700">
                  {c.correspondent.username.slice(0, 2)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">@{c.correspondent.username}</span>
                  <span className="text-xs text-neutral-400">· {timeAgo(c.lastMessage.createdAt)}</span>
                </div>
                <p className="truncate text-xs text-neutral-500">
                  {c.lastMessage.fromUserId === user.id ? "You: " : ""}
                  {c.lastMessage.body}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                  {c.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
