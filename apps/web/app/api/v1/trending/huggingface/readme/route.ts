import { NextResponse } from "next/server";
import { huggingFaceModelCard, TrendingUnavailable } from "@/lib/trending";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

/**
 * A Hugging Face model card rendered to HTML (ticket 0071) — frontmatter
 * stripped, markdown-it (safe) rendered. `?model=owner/name` →
 * `{ model, readmeHtml }` (null when the card is absent).
 */
export async function GET(req: Request) {
  const model = new URL(req.url).searchParams.get("model") ?? "";
  try {
    const card = await huggingFaceModelCard(model);
    return NextResponse.json(
      { model, readmeHtml: card ? renderMarkdown(card) : null },
      { headers: CORS },
    );
  } catch (err) {
    if (err instanceof TrendingUnavailable) {
      return NextResponse.json({ error: err.message }, { status: 400, headers: CORS });
    }
    console.error("[aix/web] hf model card failed", err);
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502, headers: CORS });
  }
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
