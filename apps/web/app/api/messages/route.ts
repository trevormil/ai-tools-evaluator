import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, users } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { listConversations, sendMessage } from "@/lib/messages";

export const dynamic = "force-dynamic";

const Body = z.object({
  toUserId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
});

/** Send a DM to another user. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = Body.parse(await req.json());
    if (input.toUserId === user.id) {
      return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
    }
    const target = getDb().select({ id: users.id }).from(users).where(eq(users.id, input.toUserId)).get();
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const message = sendMessage(user.id, input.toUserId, input.body);
    notify({ userId: input.toUserId, actorId: user.id, type: "dm" });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Conversation list for the signed-in user. */
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ conversations: listConversations(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
