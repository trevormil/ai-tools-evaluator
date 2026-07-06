import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { setProfileLinks } from "@/lib/profile-links";
import { PROFILE_LINK_KINDS } from "@/lib/profile-link-kinds";

export const dynamic = "force-dynamic";

const Body = z.object({
  links: z
    .array(
      z.object({
        kind: z.enum(PROFILE_LINK_KINDS),
        url: z.string().url().max(300).or(z.literal("")),
      }),
    )
    .max(PROFILE_LINK_KINDS.length),
});

/** Replace the current user's external profile links (self-only). */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const { links } = Body.parse(await req.json());
    const saved = setProfileLinks(user.id, links.filter((l) => l.url !== ""));
    return NextResponse.json({ links: saved });
  } catch (err) {
    return errorResponse(err);
  }
}
