import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { upsertStackEntry, deleteStackEntry, STACK_STATUSES } from "@/lib/stack";
import { emitActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const UpsertBody = z
  .object({
    itemId: z.string().optional(),
    toolName: z.string().max(120).optional(),
    status: z.enum(STACK_STATUSES),
    take: z.string().max(2000).optional(),
    rating: z.number().int().min(1).max(5).optional(),
  })
  .refine((b) => b.itemId || (b.toolName && b.toolName.trim().length > 0), {
    message: "Provide an itemId or a toolName",
  });

/** Create or update one of the current user's stack entries. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = UpsertBody.parse(await req.json());
    const entry = upsertStackEntry(user.id, body);

    // Feed activity + notify the item's original poster (best-effort).
    if (entry.itemId) {
      emitActivity({ actorId: user.id, verb: "stack_added", objectType: "item", objectId: entry.itemId });
      const poster = getDb().select({ id: items.postedById }).from(items).where(eq(items.id, entry.itemId)).get();
      if (poster?.id) notify({ userId: poster.id, actorId: user.id, type: "stack_add", objectType: "item", objectId: entry.itemId });
    } else {
      emitActivity({ actorId: user.id, verb: "stack_added", objectType: "stack", objectId: entry.id });
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

const DeleteBody = z.object({ id: z.string() });

/** Remove one of the current user's stack entries (ownership enforced). */
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { id } = DeleteBody.parse(await req.json());
    const ok = deleteStackEntry(user.id, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
