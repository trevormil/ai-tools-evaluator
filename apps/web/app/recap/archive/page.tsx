import Link from "next/link";
import { recentRecapDates, getRecap, recapDateLabel, verdictSummary } from "@/lib/recap";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recap archive — AIx",
  description: "Every nightly recap: the tools judged, night by night.",
};

/** The archive — every night we judged tools, newest first. */
export default async function RecapArchivePage() {
  const dates = recentRecapDates(90);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <p className="eyebrow">The archive</p>
        <h1 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
          Every night, on the record.
        </h1>
        <p className="mt-1 text-sm text-muted">
          {dates.length === 0
            ? "No recaps yet — the first lands the next time the scanner runs."
            : `${dates.length} night${dates.length === 1 ? "" : "s"} of verdicts.`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {dates.map((date) => {
          const recap = getRecap(date);
          if (!recap) return null;
          return (
            <Link
              key={date}
              href={`/recap/${date}`}
              className="card card-hover flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold">{recapDateLabel(date)}</p>
                <p className="line-clamp-1 text-xs text-muted">
                  {verdictSummary(recap.verdictCounts)}
                </p>
              </div>
              <span className="data shrink-0 text-xs text-faint">
                {recap.total} tool{recap.total === 1 ? "" : "s"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
