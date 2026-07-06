import { METRICS, type Scorecard as ScorecardType } from "@aix/core";
import { ScoreBar } from "./score-bar";

/** The ten-metric report card as a table with per-metric bar + rationale. */
export function Scorecard({ scores, overall }: { scores: ScorecardType; overall: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
            <th className="py-2 pr-4 font-medium">Metric</th>
            <th className="w-40 py-2 pr-4 font-medium">Score</th>
            <th className="py-2 font-medium">Why</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => {
            const s = scores[m.key];
            return (
              <tr key={m.key} className="border-b border-neutral-100 align-top dark:border-neutral-800/70">
                <td className="py-3 pr-4">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-neutral-500">{Math.round(m.weight * 100)}% weight</div>
                </td>
                <td className="py-3 pr-4">
                  <ScoreBar score={s.score} />
                </td>
                <td className="py-3 text-neutral-600 dark:text-neutral-300">{s.rationale}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-neutral-300 dark:border-neutral-700">
            <td className="py-3 pr-4 font-semibold">Overall</td>
            <td className="py-3 pr-4">
              <ScoreBar score={overall} />
            </td>
            <td className="py-3 text-xs text-neutral-500">Weighted final score</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
