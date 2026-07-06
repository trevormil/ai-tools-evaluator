import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import {
  listNotifications,
  markAllNotificationsRead,
  unreadNotificationCount,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Recent notifications + unread count for the signed-in user. */
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({
      notifications: listNotifications(user.id),
      unread: unreadNotificationCount(user.id),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Mark all of the signed-in user's notifications read. */
export async function POST() {
  try {
    const user = await requireUser();
    markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
