---
id: 78
title: "Daily pick skews to RAG/vector infra: pickScore rewards fame + easy install, has no product-shape signal"
status: in-progress
priority: high
horizon: now
hitl: false
type: bug
source: manual
created: 2026-07-25
updated: 2026-07-25
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/78"]
refs: []
depends_on: []
acceptance:
  - "A pick-only `productShape` signal (0-100 + rationale) is produced by the evaluator and carried on the Evaluation; it is NOT one of the ten metrics and never affects overallScore"
  - "PICK_WEIGHTS drops `traction` entirely and gives productShape the largest single weight; weights still sum to 1"
  - "pickScoreOf renormalizes over the present components when productShape is absent, so the 134 pre-existing prod items still score sanely"
  - "integration: knowledge can never be THE featured daily pick (llm-action regression), enforced by a test"
  - "A category picked within PICK_COOLDOWN_DAYS is penalized, so the pick cannot be the same category on consecutive days; falls back rather than picking nothing on a thin day"
  - "Replaying the real 07-23 batch, buzz (a product) outranks qdrant/meilisearch/lightrag/llm-action (infra + reference) under the new criteria"
  - "The bot's digest prefers the item the scanner actually stamped dailyPickAt, so Discord and the site can't feature different items"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Measured against the prod dump (134 items, 18 daily picks): **10 of the last 18
picks are RAG/vector/search infra** — lightrag, qdrant, meilisearch, open-webui,
dify, anything-llm, mempalace, langflow, pageindex, llm-app. The 07-24 pick was
`liguodongiot/llm-action`, a Chinese-language README link-dump with
`integration: knowledge` — not runnable software at all.

`block/buzz` (Slack-for-agents, a real product) WAS graded on 07-23 and lost:
pickScore 72 vs graphify 90.

Three causes, all in `packages/core/src/pick.ts`:

1. **No product-shape signal exists anywhere in the schema.** All five pick
   inputs (`aiEngineerFit .40 / utility .25 / traction .15 / easeOfAdoption .12
   / composability .08`) are things a mature infra primitive maxes out. Qdrant is
   useful + adopted + `docker run` + composable → 93. Buzz is a real product but
   a heavier self-hosted lift → easeOfAdoption 40, traction 50 → 72. The criteria
   measures *safe, popular, easy to install*, which is what a vector DB is and
   what a product isn't.

2. **`traction` is a fame tax and it's double-counted.** Discovery already ranks
   the candidate pool by star velocity; traction then re-rewards popularity — and
   the most famous AI repos *are* vector DBs. qdrant 100 / llm-action 85 vs buzz
   50 / puppetmaster 55.

3. **`aiEngineerFit` holds 40% of the weight but barely discriminates.** Among
   pick-eligible items it clusters 85–95 (sd 13.4). Weighted-sd per component:
   aiEngineerFit 5.38, traction 4.07, utility 2.01, easeOfAdoption 1.98,
   composability 1.53 — traction has nearly the ranking power of a term weighted
   2.7x larger. In practice **traction picks the winner.**

Secondary: `integration: knowledge` is pick-eligible (cause of the llm-action
pick), and there is zero anti-repetition — 5 `rag` picks with no memory of what
was featured recently.

Decision (with Trevor, 2026-07-25): add the real evaluator signal rather than
heuristic deny-lists, because deny-listing `rag` would have blocked lightrag but
still would not have *promoted* Buzz — nothing in the schema knows Buzz is a
product. Plus a category cooldown for variety. See ADR-0004.
