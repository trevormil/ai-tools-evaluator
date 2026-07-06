import { METRICS, type Scorecard as ScorecardType } from "@aix/core";
import { ScoreBar } from "./score-bar";

/** The ten-metric report card as a benchmark printout: per-metric bar + rationale. */
export function Scorecard({ scores, overall }: { scores: ScorecardType; overall: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left [&>th]:border-b [&>th]:border-[var(--border)]">
            <th className="py-2 pr-4"><span className="eyebrow before:content-none">Metric</span></th>
            <th className="w-44 py-2 pr-4"><span className="eyebrow before:content-none">Score</span></th>
            <th className="py-2"><span className="eyebrow before:content-none">Why</span></th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => {
            const s = scores[m.key];
            return (
              <tr key={m.key} className="align-top [&>td]:border-b [&>td]:border-[var(--border)]">
                <td className="py-3 pr-4">
                  <div className="font-semibold">{m.label}</div>
                  <div className="data text-[11px] text-faint">{Math.round(m.weight * 100)}% weight</div>
                </td>
                <td className="py-3 pr-4">
                  <ScoreBar score={s.score} />
                </td>
                <td className="py-3 text-muted">{s.rationale}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--border-strong)]">
            <td className="py-3 pr-4">
              <div className="text-base font-bold">Overall</div>
              <div className="data text-[11px] text-faint">weighted final</div>
            </td>
            <td className="py-3 pr-4">
              <ScoreBar score={overall} />
            </td>
            <td className="py-3 text-[11px] text-faint">The one number that survives the ten.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
