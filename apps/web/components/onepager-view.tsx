import Link from "next/link";
import type { Item } from "@aix/db";
import { METRICS, CATEGORY_LABELS, lensFor, type Category, type Evaluation } from "@aix/core";
import { SegMeter } from "@/components/seg-meter";
import { VerdictBadge } from "@/components/verdict-badge";
import { CopyButton } from "@/components/copy-button";
import { ArchDiagram } from "@/components/arch-diagram";

/**
 * The item spec sheet (tickets 0081/0083), shared by the standalone
 * /item/[slug]/onepager route (hero on) and the item page's One-pager tab
 * (hero off — the item header already shows title/verdict there).
 */
export function OnePagerView({
  item,
  evaluation,
  hero = true,
}: {
  item: Item;
  evaluation: Evaluation;
  hero?: boolean;
}) {
  const lens = lensFor(evaluation.source);
  const body = evaluation.body as Record<string, string | undefined>;
  const evaluatedAt = evaluation.evaluatedAt.slice(0, 10);

  return (
    <div className="flex w-full flex-col gap-10">
      {/* Spec-plate hero: identity, verdict, the readout. */}
      <section className={`flex flex-col gap-4 ${hero ? "pt-4" : ""}`}>
        {hero && (
          <>
            <p className="eyebrow">
              Spec sheet · {CATEGORY_LABELS[item.category as Category] ?? item.category} ·
              evaluated {evaluatedAt} by{" "}
              {evaluation.evaluatedBy === "ai" ? (evaluation.model ?? "ai") : "human"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
                {item.title}
              </h1>
              <VerdictBadge verdict={item.verdict} />
            </div>
            <p className="max-w-xl text-base text-muted">{item.tagline}</p>
          </>
        )}
        <div className="card flex items-center gap-4 p-4">
          <div className="flex items-baseline gap-1">
            <span className="data text-4xl font-semibold leading-none">{item.overallScore}</span>
            <span className="data text-xs text-faint">/100 overall</span>
          </div>
          <SegMeter score={item.overallScore} className="flex-1" />
          <span className="data text-[11px] uppercase tracking-[0.18em] text-faint">
            noise {item.noiseScore}
          </span>
        </div>
      </section>

      {/* What it is. */}
      {body.whatItIs && (
        <section className="flex flex-col gap-3">
          <h2 className="eyebrow !text-[12px]">What it is</h2>
          <p className="text-sm leading-relaxed text-muted">{body.whatItIs}</p>
        </section>
      )}

      {/* Deep dive (0083): learn it without installing it. */}
      {evaluation.deepDive && (
        <section className="flex flex-col gap-3">
          <h2 className="eyebrow !text-[12px]">How it works</h2>
          {evaluation.deepDive.howItWorks.split(/\n\n+/).map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted">
              {para}
            </p>
          ))}
        </section>
      )}

      {evaluation.deepDive?.architecture && (
        <section className="flex flex-col gap-4">
          <h2 className="eyebrow !text-[12px]">Architecture</h2>
          <div className="card p-5">
            <ArchDiagram architecture={evaluation.deepDive.architecture} />
          </div>
        </section>
      )}

      {evaluation.deepDive?.internals && evaluation.deepDive.internals.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="eyebrow !text-[12px]">Under the hood</h2>
          <div className="card grid grid-cols-1 gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
            {evaluation.deepDive.internals.map((n) => (
              <div key={n.title} className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-xs leading-relaxed text-faint">{n.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The full scorecard — real scores through the signature instrument. */}
      <section className="flex flex-col gap-4">
        <h2 className="eyebrow !text-[12px]">The scorecard</h2>
        <div className="card grid grid-cols-1 gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
          {METRICS.map((m) => {
            const s = evaluation.scores[m.key];
            return (
              <div key={m.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{m.label}</span>
                  <span className="data text-xs font-semibold">{s.score}</span>
                </div>
                <SegMeter score={s.score} size="sm" />
                <p className="text-xs text-faint">{s.rationale}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Make the call: situational adopt/skip + the exact install line. */}
      {(evaluation.decision || evaluation.quickstart) && (
        <section className="flex flex-col gap-4">
          <h2 className="eyebrow !text-[12px]">Make the call</h2>
          {evaluation.quickstart && (
            <div
              className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <code className="data min-w-0 flex-1 truncate text-xs">
                {evaluation.quickstart.install}
              </code>
              <CopyButton text={evaluation.quickstart.install} />
            </div>
          )}
          {evaluation.decision && (
            <div className="card grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
              <div>
                <p
                  className="data text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "var(--v-essential-fg)" }}
                >
                  Adopt if
                </p>
                <ul className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
                  {evaluation.decision.adoptIf.map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-[5px] h-2 w-2 shrink-0"
                        style={{ background: "var(--v-essential-fg)" }}
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p
                  className="data text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "var(--v-trap-fg)" }}
                >
                  Skip if
                </p>
                <ul className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
                  {evaluation.decision.skipIf.map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-[5px] h-2 w-2 shrink-0"
                        style={{ background: "var(--v-trap-fg)" }}
                      />
                      {line}
                    </li>
                  ))}
                </ul>
                {evaluation.decision.insteadOf && (
                  <p className="mt-3 text-xs text-faint">
                    instead of: <span className="data">{evaluation.decision.insteadOf}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* The point of the product: the argued case against. */}
      {body.devilsAdvocate && (
        <section className="flex flex-col gap-3">
          <h2 className="eyebrow !text-[12px]">Devil&apos;s advocate</h2>
          <blockquote
            className="card border-l-4 p-4 text-sm leading-relaxed text-muted"
            style={{ borderLeftColor: "var(--brand)" }}
          >
            {body.devilsAdvocate}
          </blockquote>
        </section>
      )}

      {/* Who it's for. Guarded: pre-2026-07 legacy rows may lack audience. */}
      {evaluation.audience && (
        <section className="flex flex-col gap-4">
          <h2 className="eyebrow !text-[12px]">Who it&apos;s for</h2>
          <div className="card flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-semibold">AI engineer</span>
              <SegMeter score={evaluation.audience.aiEngineerFit} size="sm" className="flex-1" />
              <span className="data text-xs">{evaluation.audience.aiEngineerFit}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-semibold">Vibe coder</span>
              <SegMeter score={evaluation.audience.vibeCoderFit} size="sm" className="flex-1" />
              <span className="data text-xs">{evaluation.audience.vibeCoderFit}</span>
            </div>
            <p className="text-xs text-faint">{evaluation.audience.rationale}</p>
          </div>
        </section>
      )}

      {/* Route back / out. */}
      <section className="flex flex-wrap items-center gap-3 pb-4">
        {hero ? (
          <Link href={`/item/${item.slug}`} className="btn-primary">
            Full evaluation
          </Link>
        ) : (
          <Link href={`/item/${item.slug}/onepager`} className="btn-ghost">
            Open as full page
          </Link>
        )}
        <a href={item.url} target="_blank" rel="noreferrer" className="btn-ghost">
          {lens === "research" ? "Read paper ↗" : lens === "product" ? "Visit site ↗" : "Source ↗"}
        </a>
      </section>
    </div>
  );
}
