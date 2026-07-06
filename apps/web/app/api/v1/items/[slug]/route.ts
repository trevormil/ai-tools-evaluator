import { NextResponse } from "next/server";
import { getItemBySlug, parseEvaluation } from "@/lib/queries";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

type Params = { params: Promise<{ slug: string }> };

/** Public, read-only full evaluation for one item. 404 if missing/unpublished. */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const item = getItemBySlug(slug);
  if (!item || !item.published) {
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

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}
