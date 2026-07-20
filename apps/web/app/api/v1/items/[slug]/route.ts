import { NextResponse } from "next/server";
import { getItemBySlug, parseEvaluation } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

type Params = { params: Promise<{ slug: string }> };

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
    {
      evaluation,
      readmeMd: item.readmeMd ?? null,
      // Same safe renderer the website uses (markdown-it, html:false) so
      // native clients get real GFM without shipping a renderer.
      readmeHtml: item.readmeMd ? renderMarkdown(item.readmeMd) : null,
    },
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
