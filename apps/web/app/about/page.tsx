import type { Metadata } from "next";
import Link from "next/link";
import { METRICS } from "@aix/core";

export const metadata: Metadata = {
  title: "About — AIx, the tool evaluation bench",
  description:
    "What AIx is, the problem it exists to solve, and how the bench works: a daily capped scan, a ten-metric scorecard, and a forced verdict on every tool.",
};

/**
 * The one-page explainer (ticket 0079): the bench's own spec sheet. Fully
 * static — the copy and the pipeline are authored here; the metric rows come
 * from @aix/core METRICS so the page can never drift from the real scorecard.
 */

const STATIONS = [
  {
    code: "ST-01",
    title: "Scan",
    body: "Every day the scanner sweeps GitHub trending, Product Hunt, and arXiv — and drains the link-drop queue, where anyone can submit a repo from the site or Discord.",
  },
  {
    code: "ST-02",
    title: "Cap + dedup",
    body: "At most ten new items a day, and anything already on the bench is dropped before grading. A directory you can actually keep up with, not another firehose.",
  },
  {
    code: "ST-03",
    title: "Scored, ten ways",
    body: "Ten metrics, each 0–100 with a one-line rationale, weighted into one overall score. Judged through a lens: a tool against a capable base agent, a product against its incumbents, a paper against prior work.",
  },
  {
    code: "ST-04",
    title: "Verdict, forced",
    body: "No hedging: every item gets exactly one stamp, and every evaluation must argue the devil's-advocate case — why you do NOT need this — before it earns anything above it.",
  },
  {
    code: "ST-05",
    title: "Published",
    body: "The most product-shaped item headlines the feed as the daily pick; everything graded lands in the directory, and practitioners pile on with takes, stacks, and “I use this.”",
  },
] as const;

const VERDICTS = [
  { cls: "verdict-essential", label: "essential", note: "delivers what a base agent plainly cannot" },
  { cls: "verdict-worthwhile", label: "worthwhile", note: "earns its keep for its audience" },
  { cls: "verdict-niche", label: "niche", note: "real value, narrow situation" },
  { cls: "verdict-marginal", label: "marginal", note: "thin gain over what you have" },
  { cls: "verdict-redundant", label: "redundant", note: "already covered by your stack" },
  { cls: "verdict-trap", label: "complexity-trap", note: "costs more parts than it pays back" },
] as const;

const NOISE = [
  "🚀 game-changer",
  "40k stars overnight",
  "yet another agent framework",
  "10x your workflow",
  "SOTA (self-reported)",
  "just ship it",
  "v0.0.1",
  "thread 🧵 (1/23)",
];

const IS_LIST = [
  "A strict ten-metric scorecard with a forced verdict on every item.",
  "A directory that grows ten items a day, deduped — small enough to trust.",
  "A social layer for practitioners: takes, stacks, and “I use this” from people who run the tool.",
  "Honest about its judge: every evaluation names the model that graded it.",
];

const IS_NOT_LIST = [
  "A popularity chart — stars measure fascination, and fascination doesn't move a score.",
  "A news feed or a press-release amplifier.",
  "Marketing — “essential” is reserved for what a base agent plainly cannot do.",
  "A pay-to-play listing. Nothing on the bench bought its way on.",
];

/** Segment count encodes the metric's real weight in the overall score. */
function weightSegments(weight: number): number {
  return Math.max(2, Math.round(weight * 50));
}

export default function AboutPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-14">
      {/* Spec-plate hero: the instrument describes itself. */}
      <section className="flex flex-col gap-5 pt-4">
        <p className="eyebrow">Spec sheet · Model AIX-01 · Tool evaluation bench</p>
        <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
          Is this AI tool <span className="text-brand">actually</span> worth it?
        </h1>
        <p className="max-w-xl text-base text-muted">
          AIx puts trending AI tools, products, and research on a measurement bench: a harsh,
          structured evaluation instead of a hype cycle. Signal in, noise rejected.
        </p>
        {/* Signature readout: the bench meter, oversized. */}
        <div aria-hidden className="card flex items-center gap-4 p-4">
          <span className="data text-[11px] uppercase tracking-[0.22em] text-faint">in</span>
          <div className="seg-meter flex-1">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`seg ${i < 4 ? "seg-on-weak" : i < 7 ? "seg-on-mixed" : "seg-on-strong"}`}
              />
            ))}
          </div>
          <span className="data text-[11px] uppercase tracking-[0.22em] text-faint">verdict</span>
        </div>
      </section>

      {/* The problem: the firehose, in its own words. */}
      <section className="flex flex-col gap-4">
        <h2 className="eyebrow !text-[12px]">The problem</h2>
        <p className="font-display text-2xl font-bold tracking-tight">
          Every day ships another dozen &ldquo;game-changers.&rdquo;
        </p>
        <div className="flex flex-wrap gap-2" aria-hidden>
          {NOISE.map((n) => (
            <span key={n} className="chip opacity-80">
              {n}
            </span>
          ))}
        </div>
        <p className="max-w-xl text-sm text-muted">
          Stars, upvotes, and launch threads measure excitement, not usefulness. By the time you have
          evaluated one tool properly, five more have trended. The cost isn&apos;t missing out —
          it&apos;s adopting complexity that quietly never pays rent in your stack.
        </p>
      </section>

      {/* The pipeline: numbered because it IS a sequence. */}
      <section className="flex flex-col gap-6">
        <h2 className="eyebrow !text-[12px]">How the bench works</h2>
        <ol className="relative flex flex-col gap-4">
          {/* The rail. */}
          <span
            aria-hidden
            className="absolute bottom-6 left-[27px] top-6 w-px"
            style={{ background: "var(--border-strong)" }}
          />
          {STATIONS.map((s) => (
            <li key={s.code} className="card relative ml-14 p-4">
              <span
                className="data absolute -left-14 top-4 inline-flex h-[26px] w-[54px] items-center justify-center rounded border text-[10px] font-semibold"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border-strong)",
                  color: "var(--brand)",
                }}
              >
                {s.code}
              </span>
              <h3 className="font-display text-base font-bold tracking-tight">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The scorecard: real metrics, real weights — imported, not copied. */}
      <section className="flex flex-col gap-4">
        <h2 className="eyebrow !text-[12px]">The scorecard</h2>
        <p className="max-w-xl text-sm text-muted">
          Ten metrics, higher always better — costs are phrased as their inverse, so the whole card
          reads one way. Segment fill shows each metric&apos;s weight in the overall score.
        </p>
        <div className="card grid grid-cols-1 gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
          {METRICS.map((m) => (
            <div key={m.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{m.label}</span>
                <span className="data text-[11px] text-faint">×{m.weight.toFixed(2)}</span>
              </div>
              <div className="seg-meter seg-sm" aria-hidden>
                {Array.from({ length: 8 }, (_, i) => (
                  <span
                    key={i}
                    className={`seg ${i < weightSegments(m.weight) ? "seg-on-solid" : ""}`}
                  />
                ))}
              </div>
              <p className="text-xs text-faint">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The verdict vocabulary + the clause that keeps it honest. */}
      <section className="flex flex-col gap-4">
        <h2 className="eyebrow !text-[12px]">Six stamps, no hedging</h2>
        <ul className="flex flex-col gap-2.5">
          {VERDICTS.map((v) => (
            <li key={v.label} className="flex flex-wrap items-center gap-3">
              <span className={`verdict ${v.cls} w-[150px] justify-center`}>{v.label}</span>
              <span className="text-sm text-muted">{v.note}</span>
            </li>
          ))}
        </ul>
        <blockquote
          className="card border-l-4 p-4 text-sm"
          style={{ borderLeftColor: "var(--brand)" }}
        >
          <p className="font-semibold">The devil&apos;s-advocate clause</p>
          <p className="mt-1 text-muted">
            Every evaluation must argue, specifically, why you do <em>not</em> need the thing —
            what already covers it, and whether it is genuine capability or complexity in a trench
            coat. If the case can&apos;t be beaten, the verdict says so.
          </p>
        </blockquote>
      </section>

      {/* The closer: inspection results. */}
      <section className="flex flex-col gap-4">
        <h2 className="eyebrow !text-[12px]">What AIx is — and is not</h2>
        <div className="card grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
          <div>
            <p className="data text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--v-essential-fg)" }}>
              It is
            </p>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
              {IS_LIST.map((line) => (
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
            <p className="data text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--v-trap-fg)" }}>
              It is not
            </p>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
              {IS_NOT_LIST.map((line) => (
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
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/directory" className="btn-primary">
            Browse the directory
          </Link>
          <Link href="/submit" className="btn-ghost">
            Submit a tool
          </Link>
        </div>
      </section>
    </div>
  );
}
