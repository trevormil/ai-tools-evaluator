import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, notifications, users, posts, items, type Notification, type User } from "@aix/db";

export type NotifyInput = {
  userId: string; // recipient
  actorId?: string | null;
  type: string; // reply | dm | repost | follow | stack_add | mention
  objectType?: string | null;
  objectId?: string | null;
};

/**
 * Insert a notification for `userId`. Self-notifications are skipped. Best-effort:
 * never throws into the caller's mutation.
 */
export function notify(input: NotifyInput): void {
  try {
    if (input.actorId && input.actorId === input.userId) return;
    getDb()
      .insert(notifications)
      .values({
        userId: input.userId,
        actorId: input.actorId ?? null,
        type: input.type,
        objectType: input.objectType ?? null,
        objectId: input.objectId ?? null,
      })
      .run();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[aix/web] notify failed", err);
  }
}

export function unreadNotificationCount(userId: string): number {
  const r = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .get();
  return r?.n ?? 0;
}

export type NotificationView = {
  notification: Notification;
  actor: User | null;
  label: string;
  href: string;
};

function resolve(n: Notification, actor: User | null): { label: string; href: string } {
  const who = actor ? `@${actor.username}` : "Someone";
  const db = getDb();
  const objectLink = (): string => {
    if (n.objectType === "post") return `/post/${n.objectId}`;
    if (n.objectType === "item") {
      const it = db
        .select({ slug: items.slug })
        .from(items)
        .where(eq(items.id, n.objectId ?? ""))
        .get();
      return it ? `/item/${it.slug}` : "/";
    }
    return "/";
  };
  switch (n.type) {
    case "reply":
      return { label: `${who} replied to you`, href: objectLink() };
    case "dm":
      return {
        label: `${who} sent you a message`,
        href: actor ? `/messages/${actor.id}` : "/messages",
      };
    case "repost":
      return { label: `${who} reposted your ${n.objectType ?? "post"}`, href: objectLink() };
    case "follow":
      return { label: `${who} followed you`, href: actor ? `/u/${actor.username}` : "/" };
    case "stack_add":
      return { label: `${who} added your tool to their stack`, href: objectLink() };
    case "mention":
      return { label: `${who} mentioned you`, href: objectLink() };
    default:
      return { label: `${who} interacted with you`, href: objectLink() };
  }
}

export function listNotifications(userId: string, limit = 50): NotificationView[] {
  const rows = getDb()
    .select({ notification: notifications, actor: users })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({
    notification: r.notification,
    actor: r.actor,
    ...resolve(r.notification, r.actor),
  }));
}

export function markAllNotificationsRead(userId: string): void {
  getDb()
    .update(notifications)
    .set({ readAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .run();
}
