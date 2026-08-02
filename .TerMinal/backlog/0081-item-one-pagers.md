---
id: 081
title: "Per-item one-pagers: spec-sheet page generated from each stored evaluation"
status: in-progress
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-08-02
updated: 2026-08-02
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/87"]
refs: ["079"]
depends_on: ["079"]
acceptance:
  - "Every scored item has /item/<slug>/onepager rendering a one-page spec sheet from its stored Evaluation JSON (no runtime AI, no new DB writes)"
  - "The page carries: verdict stamp + overall meter, tagline, what-it-is, the full ten-metric scorecard with real scores, adopt-if/skip-if decision layer, devil's advocate, audience fit"
  - "Reuses the Test Bench visual language (SegMeter, verdict stamps, eyebrows) established by /about"
  - "Item detail page links to its one-pager; pending (unscored) items 404"
  - "e2e: /item/ripgrep/onepager renders the sections; nav from the item page works"
agent_id: 1000x-ai-engineer
agent_scope: repo
agent_kind: classic
---

Follow-up to 0079 (the AIx explainer): the same infographic language, but
dynamically generated per product/repo from the evaluation already in the DB.
Rendering is pure server-component work over `parseEvaluation(item)` — zero
marginal AI cost per page.
