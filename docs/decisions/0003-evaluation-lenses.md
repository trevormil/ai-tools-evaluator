---
anchor: ADR-0003
status: accepted
date: 2026-07-10
---

# ADR-0003: Per-type evaluation lenses over one schema

## Status

Accepted. Stage 1 implemented (`packages/core/src/lenses.ts`).

## Context

AIx began as a catalog of trending GitHub repos, evaluated against a single
frame: "is this just complexity over what a capable base agent (Claude) already
does?" We want to grow it into a broader knowledge base — Claude/agent **skills**,
**ProductHunt** launches, **HackerNews**, papers — so an AI engineer can decide
what's worth adopting across the whole space, not just repos.

The ingest layer already generalizes cleanly: `DiscoverySource`
(`apps/scanner/src/types.ts`) is a pluggable adapter, `ItemSource.kind` is an
open enum, per-type signal fields are optional, and the DB stores the evaluation
as a JSON blob (no migration to add fields). The coupling to "GitHub repo vs base
agent" lived almost entirely in the **evaluation layer**: the prompt, the
required write-up sections (`vsVanilla`, `surfaceArea`), the `deltaVsBaseline`
metric's baseline, and the `integration` axis. The "vs a base agent" frame is
perfect for skills/agent tools but nonsensical for a launched SaaS product or a
research paper.

## Decision

Introduce an **evaluation lens** — `agent-tool | product | research` — over **one**
`Evaluation` schema and **one** ten-metric scorecard. The lens is derived from
`ItemSource.kind` (`KIND_LENS`) with an optional per-item `ItemSource.lens`
override (e.g. a GitHub repo that is really a product). Only three things vary by
lens:

1. **Prompt framing + baseline** — `evaluatorSystem(lens)` and
   `buildEvaluatorPrompt` inject the lens's framing and the baseline that
   `deltaVsBaseline` (and the whole verdict) is measured against: a base agent
   for `agent-tool`, incumbents/DIY for `product`, prior work for `research`.
2. **Which write-up sections are required** — three sections are common
   (`whatItIs`, `devilsAdvocate`, `whatWouldMakeItBetter`); the rest are
   lens-specific and optional at the field level, with presence enforced per lens
   by a refinement on `Evaluation`. `LENS_SECTIONS` is the single source of truth
   for section keys, titles, order, and prompt guidance — consumed by the schema,
   the prompt, the `.md` artifact, and the web item page.
3. **Optional metric weight overrides** per lens (deferred; the ten keys stay
   identical so feeds, filters, comparison, and the scorecard UI never fragment).

The metric KEYS, verdict, audience scoring, categories, and the whole
DB/feed/bot/artifact machinery are **unchanged**, so the catalog stays uniform
and comparable across types.

## Consequences

- New item types are mostly additive source adapters plus a lens choice; the core
  contract changes once (here), not per type.
- `agent-tool` reproduces the original behavior exactly — `vsVanilla`/`surfaceArea`
  are still required for it, and its `.md`/UI output is byte-identical. Stage 1 is
  a pure refactor (no user-visible change until a non-repo source ships).
- The `dailyPickAt`-style per-lens metric weighting is available but intentionally
  unused until the `product` lens has real items to tune against.
- HackerNews is modeled as a **router**, not a lens: an HN adapter resolves an item
  into `github_repo`/`product` (or feeds a separate digest), so it reuses existing
  lenses rather than adding a fourth.

## Alternatives considered

- **Keep the single agent lens; admit only items it fits.** Least work, but a much
  narrower knowledge base — rejected against the goal of broad coverage.
- **Full per-type schemas (discriminated union).** Most faithful per domain, but
  fragments filtering, score comparability, and the UI, and is a large refactor —
  rejected as over-engineering for the payoff (§2).

## Rollout

Staged, one PR each: (1) lens core [this ADR], (2) UI/bot lens-awareness,
(3) Skills source + agent-tool lens, (4) ProductHunt source + product lens,
(5) HackerNews router. Stage 1 is the only one touching the core contract.
