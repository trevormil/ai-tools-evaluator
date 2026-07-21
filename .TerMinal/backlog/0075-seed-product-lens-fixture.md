---
id: 075
title: "seed: add a product-lens fixture so all three lenses are drift-guarded"
status: open
priority: medium
horizon: next
hitl: false
type: chore
source: manual
created: 2026-07-21
updated: 2026-07-21
prs: []
refs: ["066"]
depends_on: []
acceptance:
  - "EVALUATIONS contains at least one fixture whose lens resolves to product"
  - "seed.test.ts asserts full lens coverage: new Set(lenses) equals LENSES"
  - "bun test and bun packages/db/src/seed.ts both stay green"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

`packages/db/src/seed.test.ts` (added with the 0066 fix) round-trips every seed
fixture through the strict schema and checks each one has its lens's required
body sections. That is what would have caught 0066 in `bun test` instead of only
in a dead e2e web server.

The guard is currently partial: fixtures cover `agent-tool` and `research` only,
so a future required section added to the **`product`** lens would drift exactly
the way `research.vsPriorWork` did, undetected. The coverage assertion was
written and then deliberately weakened to `covered.size > 1` rather than
smuggling a whole hand-authored product evaluation into an unrelated
privacy-page PR.

Work: author one real product-lens fixture in the product's voice (a launched
product rather than a library or paper — the lens asks for `vsAlternatives` and
a product-framed devil's advocate), then restore the strict assertion:

```ts
expect([...covered].sort()).toEqual([...LENSES].sort());
```
