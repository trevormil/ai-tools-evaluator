import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { toPublicUser } from "@/lib/public-api";
import { unreadNotificationCount } from "@/lib/notifications";
import { totalUnreadMessages } from "@/lib/messages";

export const dynamic = "force-dynamic";

/**
 * Session bootstrap for clients (ticket 0059): who am I, plus the unread
 * counts the tab badges need. Bearer (mobile) or cookie (web).
 */
export async function GET(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({
    user: toPublicUser(user),
    unreadNotifications: unreadNotificationCount(user.id),
    unreadMessages: totalUnreadMessages(user.id),
  });
}
