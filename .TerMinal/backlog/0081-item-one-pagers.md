---
id: 081
title: "Per-item one-pagers: spec-sheet page generated from each stored evaluation"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-08-02
updated: 2026-08-02
prs: []
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

Closed 2026-08-02: PR #87 was auto-closed unmerged during the stacked-merge
mishap; the work landed on main via roll-up PR #88 (415cd19).
