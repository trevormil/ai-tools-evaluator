---
id: 060
title: "iOS: read-only home feed + item detail tabs (Evaluation / Scorecard / README)"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/56"]
refs: []
depends_on: ["058", "059"]
acceptance:
  - "Feed tab renders the anonymous unified timeline (items, posts, activities with embeds), cursor-paginated with pull-to-refresh and client-side dedup"
  - "Today's pick card tops the feed when a daily pick exists; its absence never blocks the timeline"
  - "Item detail gains segmented tabs: Evaluation (lens-aware sections + audience meters + make-the-call), Scorecard (10 metrics), README (when present); share via ShareLink"
  - "Pending items show 'Awaiting score…' matching web"
  - "ViewModel unit tests: pagination/dedup, daily-pick resilience, error handling (mocked network)"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Bring the two richest web surfaces to iOS read-only: the home timeline
(`apps/web/app/page.tsx`) and the full item page
(`apps/web/app/item/[slug]/page.tsx`). No composers, votes, or any writes —
the app browses; the website is where accounts live.

*(Rescoped 2026-07-20: takes/discussion/vote/repost/rescore UI dropped with
the read-only pivot.)*
