import Link from "next/link";
import type { Evaluation } from "@aix/core";
import type { Recap } from "@/lib/recap";
import { recapDateLabel, verdictSummary } from "@/lib/recap";
import { parseEvaluation } from "@/lib/queries";
import { VerdictBadge } from "./verdict-badge";
import { SegMeter } from "./seg-meter";
import { ItemRow } from "./item-row";
import { NewsletterForm } from "./newsletter-form";

/** First sentence of the devil's-advocate section — the recap's hook. */
function trapHook(item: { evaluationJson: string }): string | null {
  try {
    const ev = JSON.parse(item.evaluationJson) as Partial<Evaluation>;
    const da = ev.body?.devilsAdvocate;
    if (!da) return null;
    const m = da.match(/^.*?[.!?](\s|$)/);
    return (m ? m[0] : da).trim();
  } catch {
    return null;
  }
}

/**
 * The nightly recap, rendered editorially (ticket 0040). One dated issue:
 * the summary line, the lead pick, every verdict, the complexity trap of the
 * night, and what engineers are running. Shared by /recap and the archive.
 */
export function RecapView({ recap, prev, next }: { recap: Recap; prev?: string; next?: string }) {
  const lead = recap.leadPick;
  const leadEval = lead ? safeEval(lead) : null;
  const trap = recap.complexityTrap;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-token pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">The nightly recap</p>
          <div className="flex items-center gap-1 text-xs">
            {prev ? (
              <Link href={`/recap/${prev}`} className="data text-muted hover:text-brand">
                ← {prev}
              </Link>
            ) : (
              <span className="data text-faint">← —</span>
            )}
            <span className="text-faint">·</span>
            {next ? (
              <Link href={`/recap/${next}`} className="data text-muted hover:text-brand">
                {next} →
              </Link>
            ) : (
              <span className="data text-faint">latest</span>
            )}
          </div>
        </div>
        <div>
          <h1 className="font-display text-2xl font-black leading-tight tracking-tight sm:text-4xl">
            {recapDateLabel(recap.date)}
          </h1>
          <p className="mt-2 text-lg text-muted">
            {recap.total} tool{recap.total === 1 ? "" : "s"} judged tonight —{" "}
            <span className="text-ink">{verdictSummary(recap.verdictCounts)}</span>.
          </p>
        </div>
      </header>

      {/* The one that matters. */}
      {lead && (
        <section className="flex flex-col gap-3">
          <p className="eyebrow">The one that matters</p>
          <Link href={`/item/${lead.slug}`} className="card card-hover flex flex-col gap-3 p-5">
            <div className="flex items-start gap-4">
              {lead.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lead.coverImageUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  style={{ background: "var(--surface-2)" }}
                />
              ) : (
                <span
                  className="data flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-semibold text-faint"
                  style={{ background: "var(--surface-2)" }}
                >
                  {lead.title.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl font-black tracking-tight">
                    {lead.title}
                  </span>
                  <VerdictBadge verdict={lead.verdict} />
                </div>
                <p className="mt-1 text-sm text-muted">{lead.tagline}</p>
              </div>
              <span className="data shrink-0 text-2xl font-semibold">
                {lead.overallScore}
                <span className="text-xs font-normal text-faint">/100</span>
              </span>
            </div>
            {leadEval?.body.devilsAdvocate && (
              <p className="border-l-2 border-[var(--border-strong)] pl-3 text-sm italic text-muted">
                Devil&apos;s advocate: {trapHook(lead)}
              </p>
            )}
          </Link>
        </section>
      )}

      {/* Complexity trap of the night. */}
      {trap && (
        <section className="flex flex-col gap-2">
          <p className="eyebrow !text-[var(--band-weak)]">Complexity trap of the night</p>
          <Link
            href={`/item/${trap.slug}`}
            className="card card-hover flex items-center gap-3 p-4"
            style={{ borderColor: "color-mix(in srgb, var(--band-weak) 40%, var(--border))" }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold tracking-tight">{trap.title}</span>
                <VerdictBadge verdict={trap.verdict} />
                <span className="data text-xs text-faint">noise {trap.noiseScore}/100</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">
                {trapHook(trap) ?? trap.tagline}
              </p>
            </div>
          </Link>
        </section>
      )}

      {/* Every verdict tonight. */}
      <section className="flex flex-col gap-3">
        <p className="eyebrow">Every verdict tonight</p>
        <div className="flex flex-col gap-2">
          {recap.items.map((item) => (
            <ItemRow key={item.id} item={item} uses={item.uses} />
          ))}
        </div>
      </section>

      {/* What engineers are running. */}
      {recap.topAdopted.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="eyebrow">What engineers are running</p>
          <div className="card flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
            {recap.topAdopted.map((item) => (
              <Link
                key={item.id}
                href={`/item/${item.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:text-brand"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="truncate font-medium">{item.title}</span>
                <span className="data shrink-0 text-xs text-faint">
                  {item.uses} {item.uses === 1 ? "engineer" : "engineers"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Subscribe — the recap is a push product. */}
      <section className="card flex flex-col gap-2 p-5">
        <p className="font-display text-lg font-bold tracking-tight">
          Get the verdict in your inbox, nightly.
        </p>
        <p className="text-sm text-muted">
          One email a night — the tools judged, the traps named. No fluff.
        </p>
        <div className="mt-1">
          <NewsletterForm />
        </div>
      </section>

      <div className="flex items-center justify-between text-xs">
        <Link href="/recap/archive" className="data text-muted hover:text-brand">
          ← All recaps
        </Link>
        <Link href="/" className="data text-muted hover:text-brand">
          Browse the directory →
        </Link>
      </div>
    </div>
  );
}

function safeEval(item: { evaluationJson: string; scoreStatus: string }): Evaluation | null {
  if (item.scoreStatus !== "scored") return null;
  try {
    return parseEvaluation(item as never);
  } catch {
    return null;
  }
}
