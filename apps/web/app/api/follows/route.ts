import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, follows, users } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({ targetUserId: z.string().min(1) });

/** Toggle following the target user. Returns the resulting follow state. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { targetUserId } = Body.parse(await req.json());
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }
    const db = getDb();
    const target = db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).get();
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, user.id), eq(follows.followeeId, targetUserId)))
      .get();

    if (existing) {
      db.delete(follows).where(and(eq(follows.followerId, user.id), eq(follows.followeeId, targetUserId))).run();
      return NextResponse.json({ following: false });
    }
    db.insert(follows).values({ followerId: user.id, followeeId: targetUserId }).run();
    return NextResponse.json({ following: true });
  } catch (err) {
    return errorResponse(err);
  }
}
