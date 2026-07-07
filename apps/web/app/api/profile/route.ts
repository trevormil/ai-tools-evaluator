import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { updateProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

const Body = z.object({
  displayName: z.string().max(80).optional(),
  bio: z.string().max(500).optional(),
});

/** Update the current user's display name / bio. */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const fields = Body.parse(await req.json());
    updateProfile(user.id, fields);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
