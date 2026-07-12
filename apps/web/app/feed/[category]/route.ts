import { CATEGORIES, CATEGORY_LABELS, type Category } from "@aix/core";
import { listItems } from "@/lib/queries";
import { renderAtomFeed } from "@/lib/feed";

export const dynamic = "force-static";

type Params = { params: Promise<{ category: string }> };

/** Prerender one feed per known category. */
export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

/** Atom feed filtered to a single category. 404s on an unknown category. */
export async function GET(_req: Request, { params }: Params) {
  const { category } = await params;
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return new Response("Unknown category", { status: 404 });
  }
  const items = listItems({ category, sort: "new", limit: 50 });
  const label = CATEGORY_LABELS[category as Category];
  const xml = renderAtomFeed(items, `/feed/${category}`, ` · ${label}`);
  return new Response(xml, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}
