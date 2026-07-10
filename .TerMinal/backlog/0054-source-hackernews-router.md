---
id: 054
title: "Eval lenses stage 5: HackerNews as a router (repo/product/digest)"
status: open
priority: medium
horizon: future
hitl: false
type: feature
source: manual
created: 2026-07-10
updated: 2026-07-10
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/39"]
refs: [ADR-0003]
depends_on: [053]
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Stage 5 of ADR-0003. HackerNews is **not its own lens** — an HN item is usually a
GitHub repo (Show HN), a launched product, or a discussion. Model an HN adapter
as a **router**: resolve each HN story into an existing kind (`github_repo` /
`producthunt`/`external_link` → product) so it reuses the agent-tool/product
lenses, OR feed a separate lightweight "HN daily digest" surface rather than the
scored catalog.

Open questions to settle first (per Trevor): which HN stories enter the catalog
vs. a digest-only feed, and how aggressively to auto-classify link targets.

- New `apps/scanner/src/sources/hackernews.ts` (Algolia/Firebase HN API) that
  classifies a story → target kind/lens, or emits digest entries.
- Points/comments as the ranking signal; dedup against repos/products already in
  the catalog.

Verify: an HN Show-HN linking a GitHub repo lands as a `github_repo` (agent-tool
lens), not a new type; a product launch lands as `product`.
