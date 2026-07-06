import { SegMeter } from "./seg-meter";

/** Score readout: segmented meter + mono value (the bench's one gauge). */
export function ScoreBar({ score, showValue = true }: { score: number; showValue?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <SegMeter score={score} size="sm" className="flex-1" />
      {showValue && <span className="data w-8 text-right text-xs font-semibold">{score}</span>}
    </div>
  );
}
