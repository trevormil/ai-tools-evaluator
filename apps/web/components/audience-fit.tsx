import { AUDIENCE_AXES, PRIMARY_AUDIENCE_LABELS, scoreBand, type AudienceFit as AudienceFitData } from "@aix/core";
import { scoreColorClass } from "@/lib/format";

/** "Who it's for" — independent AI-engineer vs vibe-coder fit scores + rationale. */
export function AudienceFit({ audience }: { audience: AudienceFitData }) {
  const values: Record<string, number> = {
    aiEngineerFit: audience.aiEngineerFit,
    vibeCoderFit: audience.vibeCoderFit,
  };
  const top = Math.max(audience.aiEngineerFit, audience.vibeCoderFit);

  return (
    <div className="card flex flex-col gap-5 p-5">
      <div className="flex items-center gap-2 text-sm">
        <span className="eyebrow before:content-none">Primarily for</span>
        <span className="chip !text-brand !border-[var(--brand)] font-bold uppercase">
          {PRIMARY_AUDIENCE_LABELS[audience.primary]}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {AUDIENCE_AXES.map((axis) => {
          const v = values[axis.key] ?? 0;
          const band = scoreBand(v);
          const isTop = v === top;
          return (
            <div
              key={axis.key}
              className={`rounded-xl border p-4 ${isTop ? "border-[var(--brand)]" : "border-token"}`}
              style={{ background: "var(--surface-2)" }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{axis.label}</span>
                <span className="data text-2xl font-bold leading-none">{v}</span>
              </div>
              <div className="meter-track mt-3">
                <div className={`meter-fill ${scoreColorClass(band)}`} style={{ width: `${v}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">{axis.desc}</p>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted">{audience.rationale}</p>
    </div>
  );
}
