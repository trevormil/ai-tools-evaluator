import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb, messages, users, type Message, type User } from "@aix/db";

/** Send a DM. Returns the inserted row. */
export function sendMessage(fromUserId: string, toUserId: string, body: string): Message {
  return getDb().insert(messages).values({ fromUserId, toUserId, body }).returning().get();
}

export type Conversation = {
  correspondent: User;
  lastMessage: Message;
  unread: number;
};

/**
 * One row per distinct correspondent: their latest message with the viewer plus
 * the count of unread (viewer is recipient, unread) messages from them.
 */
export function listConversations(userId: string): Conversation[] {
  const db = getDb();
  const rows = db
    .select()
    .from(messages)
    .where(or(eq(messages.fromUserId, userId), eq(messages.toUserId, userId)))
    .orderBy(desc(messages.createdAt))
    .all();

  const byOther = new Map<string, { last: Message; unread: number }>();
  for (const m of rows) {
    const otherId = m.fromUserId === userId ? m.toUserId : m.fromUserId;
    const entry = byOther.get(otherId);
    const isUnread = m.toUserId === userId && m.readAt == null;
    if (!entry) {
      byOther.set(otherId, { last: m, unread: isUnread ? 1 : 0 });
    } else if (isUnread) {
      entry.unread += 1;
    }
  }

  const out: Conversation[] = [];
  for (const [otherId, { last, unread }] of byOther) {
    const u = db.select().from(users).where(eq(users.id, otherId)).get();
    if (u) out.push({ correspondent: u, lastMessage: last, unread });
  }
  out.sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
  return out;
}

/** Full thread between two users, oldest first. */
export function getThread(userId: string, otherId: string): Message[] {
  return getDb()
    .select()
    .from(messages)
    .where(
      or(
        and(eq(messages.fromUserId, userId), eq(messages.toUserId, otherId)),
        and(eq(messages.fromUserId, otherId), eq(messages.toUserId, userId)),
      ),
    )
    .orderBy(messages.createdAt)
    .all();
}

/** Mark all messages the viewer received from `otherId` as read. */
export function markThreadRead(userId: string, otherId: string): void {
  getDb()
    .update(messages)
    .set({ readAt: Math.floor(Date.now() / 1000) })
    .where(
      and(eq(messages.toUserId, userId), eq(messages.fromUserId, otherId), isNull(messages.readAt)),
    )
    .run();
}

export function totalUnreadMessages(userId: string): number {
  const r = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(messages)
    .where(and(eq(messages.toUserId, userId), isNull(messages.readAt)))
    .get();
  return r?.n ?? 0;
}
