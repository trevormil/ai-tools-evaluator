import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, votes } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { recomputeAggregate } from "@/lib/queries";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  targetType: z.enum(["item", "post", "comment"]),
  targetId: z.string().min(1),
  value: z.union([z.literal(1), z.literal(-1)]),
});

/**
 * Cast/toggle a vote. Unique per (user,target) via the DB index; re-sending the
 * same value clears the vote (toggle off), a different value flips it.
 * Returns the recomputed net count and the viewer's current vote value.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { targetType, targetId, value } = Body.parse(await req.json());
    const db = getDb();

    const existing = db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.userId, user.id),
          eq(votes.targetType, targetType),
          eq(votes.targetId, targetId),
        ),
      )
      .get();

    let currentValue: number = value;
    if (existing) {
      if (existing.value === value) {
        db.delete(votes).where(eq(votes.id, existing.id)).run();
        currentValue = 0;
      } else {
        db.update(votes).set({ value }).where(eq(votes.id, existing.id)).run();
      }
    } else {
      db.insert(votes).values({ userId: user.id, targetType, targetId, value }).run();
    }

    const net = recomputeAggregate(targetType, targetId);
    return NextResponse.json({ net, value: currentValue });
  } catch (err) {
    return errorResponse(err);
  }
}
