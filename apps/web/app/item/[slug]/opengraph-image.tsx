import { ImageResponse } from "next/og";
import { CATEGORY_LABELS, type Category } from "@aix/core";
import { getItemBySlug } from "@/lib/queries";
import { loadCorpus } from "@/lib/corpus";

export const dynamic = "force-static";
export const alt = "AIx item evaluation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Prerender the per-item OG card for every item in the corpus. */
export function generateStaticParams() {
  return loadCorpus().map((i) => ({ slug: i.slug }));
}

const VERDICT_COLOR: Record<string, string> = {
  essential: "#16a34a",
  worthwhile: "#65a30d",
  niche: "#ca8a04",
  marginal: "#d97706",
  redundant: "#dc2626",
  "complexity-trap": "#b91c1c",
};

type Params = { params: Promise<{ slug: string }> };

/** 1200×630 social-preview card for a single item. */
export default async function Image({ params }: Params) {
  const { slug } = await params;
  const item = getItemBySlug(slug);

  const title = item?.title ?? "Not found";
  const verdict = item?.verdict ?? "—";
  const score = item?.overallScore ?? 0;
  const category = item ? (CATEGORY_LABELS[item.category as Category] ?? item.category) : "AIx";
  const tagline = item?.tagline ?? "This item could not be found.";
  const verdictColor = VERDICT_COLOR[verdict] ?? "#525252";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: 32 }}>
          <span style={{ color: "#f97316", fontWeight: 800 }}>AIx</span>
          <span style={{ color: "#a3a3a3" }}>{category}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: 30, color: "#d4d4d4", lineHeight: 1.3 }}>{tagline}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: verdictColor,
              color: "#fff",
              fontSize: 34,
              fontWeight: 700,
              padding: "12px 28px",
              borderRadius: "999px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {verdict}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: 72, fontWeight: 800 }}>{score}</span>
            <span style={{ fontSize: 34, color: "#a3a3a3" }}>/100</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
