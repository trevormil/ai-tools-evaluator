import { latestRecapDate, getRecap, recentRecapDates } from "@/lib/recap";
import { RecapView } from "@/components/recap-view";

/** /recap → the latest nightly recap. */
export default async function LatestRecapPage() {
  const date = latestRecapDate();
  const recap = date ? getRecap(date) : null;

  if (!recap) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div>
          <p className="eyebrow">The nightly recap</p>
          <h1 className="mt-2 font-display text-2xl font-black tracking-tight">
            No verdicts yet tonight.
          </h1>
          <p className="mt-1 text-sm text-muted">
            The scanner judges new tools daily. Check back soon for the first recap.
          </p>
        </div>
      </div>
    );
  }

  // Previous day (for the ← nav); this IS the latest, so no "next".
  const dates = recentRecapDates(2);
  const prev = dates.find((d) => d < recap.date);
  return <RecapView recap={recap} prev={prev} />;
}
