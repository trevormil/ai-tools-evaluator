import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { upsertStackEntry, deleteStackEntry, STACK_STATUSES } from "@/lib/stack";

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
