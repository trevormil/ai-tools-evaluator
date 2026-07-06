import { scoreBand } from "@aix/core";
import { scoreColorClass } from "@/lib/format";

export function ScoreBar({ score, showValue = true }: { score: number; showValue?: boolean }) {
  const band = scoreBand(score);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${scoreColorClass(band)}`} style={{ width: `${score}%` }} />
      </div>
      {showValue && <span className="w-8 text-right text-xs font-semibold tabular-nums">{score}</span>}
    </div>
  );
}
