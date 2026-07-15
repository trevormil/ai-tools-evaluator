import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { requestRescore } from "@/lib/rescore-request";

export const dynamic = "force-dynamic";

const Body = z.object({ slug: z.string().min(1).max(200) });

const MESSAGES: Record<string, string> = {
  not_found: "Item not found.",
  not_scored: "This item hasn't been scored yet — it's already in the queue.",
  pending: "A rescore is already queued for this item.",
  cooldown: "This item was rescored recently. Try again after the cooldown.",
};

const STATUS: Record<string, number> = {
  not_found: 404,
  not_scored: 409,
  pending: 409,
  cooldown: 429,
};

/**
 * Public (session-authed) rescore request. A signed-in user asks for an
 * already-scored item to be re-evaluated (e.g. the repo shipped an update);
 * once per item per week. The scanner picks it up on its next pass.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { slug } = Body.parse(await req.json());
    const outcome = requestRescore(slug, user.id, Math.floor(Date.now() / 1000));

    if (outcome.ok) {
      return NextResponse.json({ ok: true, nextEligibleAt: outcome.nextEligibleAt });
    }
    return NextResponse.json(
      {
        error: MESSAGES[outcome.code],
        nextEligibleAt: outcome.code === "cooldown" ? outcome.nextEligibleAt : undefined,
      },
      { status: STATUS[outcome.code] },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
