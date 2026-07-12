import { NextResponse } from "next/server";
import { getItemBySlug, parseEvaluation } from "@/lib/queries";
import { loadCorpus } from "@/lib/corpus";

export const dynamic = "force-static";

const CORS = { "access-control-allow-origin": "*" } as const;

type Params = { params: Promise<{ slug: string }> };

/** Prerender one JSON endpoint per item in the corpus. */
export function generateStaticParams() {
  return loadCorpus().map((i) => ({ slug: i.slug }));
}

/** Public, read-only full evaluation for one item. 404 if missing/unpublished. */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const item = getItemBySlug(slug);
  // Pending submissions have no evaluation yet — 404 to API consumers (0035).
  if (!item || !item.published || item.scoreStatus === "pending") {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
  }
  const evaluation = parseEvaluation(item);
  return NextResponse.json(
    { evaluation },
    {
      headers: {
        ...CORS,
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
