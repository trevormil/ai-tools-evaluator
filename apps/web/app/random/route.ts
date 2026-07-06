import { redirect } from "next/navigation";
import { randomToolSlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Random mode (ticket 0038): land on one tool and learn it. */
export function GET() {
  const slug = randomToolSlug();
  redirect(slug ? `/item/${slug}` : "/");
}
