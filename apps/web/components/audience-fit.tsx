import { AUDIENCE_AXES, PRIMARY_AUDIENCE_LABELS, type AudienceFit as AudienceFitData } from "@aix/core";
import { ScoreBar } from "@/components/score-bar";

/** "Who it's for" — independent AI-engineer vs vibe-coder fit scores + rationale. */
export function AudienceFit({ audience }: { audience: AudienceFitData }) {
  const values: Record<string, number> = {
    aiEngineerFit: audience.aiEngineerFit,
    vibeCoderFit: audience.vibeCoderFit,
  };
  return (
    <div className="card flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutral-500">Primarily for</span>
        <span className="chip font-semibold">{PRIMARY_AUDIENCE_LABELS[audience.primary]}</span>
      </div>
      <div className="flex flex-col gap-3">
        {AUDIENCE_AXES.map((axis) => (
          <div key={axis.key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{axis.label}</span>
            </div>
            <ScoreBar score={values[axis.key] ?? 0} />
            <p className="mt-1 text-xs text-neutral-500">{axis.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{audience.rationale}</p>
    </div>
  );
}
