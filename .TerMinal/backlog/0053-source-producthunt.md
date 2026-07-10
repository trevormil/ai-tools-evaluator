---
id: 053
title: "Eval lenses stage 4: ProductHunt source (product lens)"
status: open
priority: high
horizon: next
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

Verify: a dry-run publishes a PH product evaluated through the product lens; the
item page + `.md` show alternatives, not "vanilla Claude"; source tests cover
discovery.
