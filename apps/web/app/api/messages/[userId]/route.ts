import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getThread, markThreadRead } from "@/lib/messages";

export const dynamic = "force-dynamic";

type Params = Promise<{ userId: string }>;

/** Fetch the thread with one user and mark received messages read. */
export async function GET(_req: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { userId } = await params;
    const messages = getThread(user.id, userId);
    markThreadRead(user.id, userId);
    return NextResponse.json({ messages });
  } catch (err) {
    return errorResponse(err);
  }
}
