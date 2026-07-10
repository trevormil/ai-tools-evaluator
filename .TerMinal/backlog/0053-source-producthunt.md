---
id: 053
title: "Eval lenses stage 4: ProductHunt source (product lens) + 5+5 daily mix"
status: open
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-10
updated: 2026-07-10
prs: []
refs: [ADR-0003]
depends_on: [051]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Stage 4 of ADR-0003. Add **ProductHunt** launches as a discovery source, judged
through the `product` lens (baseline = incumbents / doing it yourself), which
Stage 1 already defined.

- Add `producthunt` to `ITEM_KINDS`; map → `product` in `KIND_LENS`.
- New `apps/scanner/src/sources/producthunt.ts` (PH API/GraphQL) implementing
  `DiscoverySource`; upvotes as the traction/ranking signal.
- `ItemSource` gains optional `upvotes` (and maker/topic if useful); PH-specific
  ranking + quality gate.
- Confirm the product-lens write-up (`vsAlternatives`, "do you actually need
  this?") reads well for a real SaaS launch.

**Daily mix (Trevor, 2026-07-10):** the 10 daily picks become **5 GitHub + 5
ProductHunt**, then Discord still features **the single best of the 10**. So the
scanner's trending phase must run multiple trending sources with per-source
budgets (5 each), publish all, and stamp the one highest-scored across both as
the daily pick (the existing dailyPick mechanism already features exactly one).
Needs env for the per-source split (e.g. AIX_TRENDING_PICKS_GITHUB /
AIX_TRENDING_PICKS_PRODUCTHUNT, or a single count split evenly) and a
ProductHunt API token (secret) at deploy — buildable/testable now with an
injected fetch fake.

Verify: a dry-run publishes 5 repos + 5 PH products; exactly one (highest score
across all 10) is stamped the daily pick; the PH item page + `.md` show
alternatives, not "vanilla Claude"; source tests cover discovery.
