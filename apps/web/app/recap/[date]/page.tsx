import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRecap, recentRecapDates, recapDateLabel, verdictSummary } from "@/lib/recap";
import { RecapView } from "@/components/recap-view";

export const dynamic = "force-dynamic";

type Params = Promise<{ date: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { date } = await params;
  const recap = getRecap(date);
  if (!recap) return { title: "Recap — AIx" };
  return {
    title: `AIx recap — ${recapDateLabel(date)}`,
    description: `${recap.total} tools judged: ${verdictSummary(recap.verdictCounts)}.`,
  };
}

/** /recap/YYYY-MM-DD → a dated recap permalink (the archive + email link here). */
export default async function DatedRecapPage({ params }: { params: Params }) {
  const { date } = await params;
  const recap = getRecap(date);
  if (!recap) notFound();

  // Neighboring judged days for prev/next navigation.
  const dates = recentRecapDates(400);
  const prev = dates.find((d) => d < date);
  const next = [...dates].reverse().find((d) => d > date);
  return <RecapView recap={recap} prev={prev} next={next} />;
}
