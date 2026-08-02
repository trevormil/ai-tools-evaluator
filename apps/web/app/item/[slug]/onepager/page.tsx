import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getItemBySlug, parseEvaluation } from "@/lib/queries";
import { OnePagerView } from "@/components/onepager-view";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

/**
 * Standalone, shareable one-pager (tickets 0081/0083/0084). Exists ONLY when
 * the item's evaluation carries a generated deepDive — older rows (and pending
 * items) have no one-pager until a rescore backfills them, so they 404 rather
 * than render a hollow sheet. The same content renders as the item page's
 * One-pager tab via OnePagerView.
 */

function onePagerFor(slug: string) {
  const item = getItemBySlug(slug);
  if (!item || item.scoreStatus === "pending") return null;
  const evaluation = parseEvaluation(item);
  if (!evaluation.deepDive) return null;
  return { item, evaluation };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const found = onePagerFor(slug);
  if (!found) return { title: "Not found — AIx" };
  return {
    title: `${found.item.title} — one-pager — AIx`,
    description: found.item.tagline,
  };
}

export default async function OnePagerPage({ params }: { params: Params }) {
  const { slug } = await params;
  const found = onePagerFor(slug);
  if (!found) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <OnePagerView item={found.item} evaluation={found.evaluation} hero />
    </div>
  );
}
