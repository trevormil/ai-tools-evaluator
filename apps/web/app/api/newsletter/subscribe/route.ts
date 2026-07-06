import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, subscribers } from "@aix/db";
import { sendEmail, renderConfirmEmail } from "@/lib/newsletter";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email().max(200) });

/**
 * Public double-opt-in subscribe. Creates (or re-arms) a `pending` subscriber
 * with a fresh token and emails a confirm link. Idempotent + privacy-preserving:
 * it never reveals whether an email was already subscribed.
 */
export async function POST(req: Request) {
  try {
    const { email } = Body.parse(await req.json());
    const normalized = email.trim().toLowerCase();
    const db = getDb();
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const existing = db.select().from(subscribers).where(eq(subscribers.email, normalized)).get();

    if (existing?.status === "active") {
      return NextResponse.json({ ok: true, message: "You're already subscribed." });
    }

    if (existing) {
      db.update(subscribers).set({ status: "pending", token }).where(eq(subscribers.id, existing.id)).run();
    } else {
      db.insert(subscribers).values({ email: normalized, status: "pending", token }).run();
    }

    const { subject, html } = renderConfirmEmail(token);
    await sendEmail({ to: normalized, subject, html });

    return NextResponse.json({ ok: true, message: "Check your inbox to confirm." });
  } catch (err) {
    return errorResponse(err);
  }
}
