import { scoreBand } from "@aix/core";
import { scoreColorClass } from "@/lib/format";

export function ScoreBar({ score, showValue = true }: { score: number; showValue?: boolean }) {
  const band = scoreBand(score);
  return (
    <div className="flex items-center gap-2.5">
      <div className="meter-track">
        <div className={`meter-fill ${scoreColorClass(band)}`} style={{ width: `${score}%` }} />
      </div>
      {showValue && <span className="data w-8 text-right text-xs font-bold">{score}</span>}
    </div>
  );
}
