import { listItems } from "@/lib/queries";
import { renderAtomFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

/** Atom feed of the latest ~50 published items across all categories. */
export function GET() {
  const items = listItems({ sort: "new", limit: 50 });
  const xml = renderAtomFeed(items, "/feed.xml");
  return new Response(xml, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}
