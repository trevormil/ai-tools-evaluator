import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listNotifications, markAllNotificationsRead } from "@/lib/notifications";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/github");

  // Snapshot current read state for rendering, then mark everything read.
  const notifications = listNotifications(user.id);
  markAllNotificationsRead(user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Notifications</h1>
      {notifications.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-500">
          Nothing yet. Interactions from other people show up here.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <Link
              key={n.notification.id}
              href={n.href}
              className={`card flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                n.notification.readAt == null ? "border-l-2 border-l-orange-500" : ""
              }`}
            >
              {n.actor?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.actor.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs dark:bg-neutral-700">
                  {n.actor?.username.slice(0, 2) ?? "?"}
                </span>
              )}
              <span className="min-w-0 flex-1 text-sm">{n.label}</span>
              <span className="text-xs text-neutral-400">{timeAgo(n.notification.createdAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
