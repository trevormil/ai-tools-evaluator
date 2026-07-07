---
id: 35
title: "Instant submissions: items appear immediately as \"Awaiting score…\""
status: closed
priority: critical
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ADR-0002, ARCH]
depends_on: [0007, 0010]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Submitting a URL creates a VISIBLE directory item immediately, in an
"Awaiting score…" state — users can comment, post takes, and "I use this"
right away. The scanner queue later fills in the evaluation (scorecard,
verdict, sections) on the SAME item.

## Scope
- `items.scoreStatus` column: "scored" (default) | "pending". Pending items
  carry placeholder score/verdict values that the UI never shows.
- POST /api/submissions: besides queueing, derive kind/externalId from the
  URL (github repo / arxiv / external link), create the pending item (dedup
  by url + kind/externalId), instant cover (GitHub owner avatar for repos),
  respond with the item slug; the submit form redirects to the new item page.
- Item page + cards: pending → "Awaiting score…" badge instead of verdict,
  no score stamp, scorecard/sections replaced by a queued-evaluation notice;
  social surface (comments, posts, I-use-this, votes) fully live.
- Scanner publish (internal /api/internal/items): when an item with the same
  kind/externalId exists as pending, UPDATE it in place to scored (keep id →
  keeps comments/votes/stack intact) instead of reporting duplicate.
- Directory sort: pending items rank by recency/social, never by fake score.

## Acceptance
- Submitting a fresh GitHub URL lands you on /item/<slug> with
  "Awaiting score…", a logo, and working comments/use-this.
- Internal publish for the same repo upgrades that item in place (id stable,
  comments preserved); no duplicate item is created.
- Directory + feed render pending items without showing placeholder numbers.
