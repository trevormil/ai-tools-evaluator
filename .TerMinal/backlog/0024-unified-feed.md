---
id: 24
title: "Unified timeline: items as first-class feed cards, rich activities, Following/Everyone toggle, load-more"
status: in-progress
priority: critical
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0004, 0019]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

The feed should strike a seamless Reddit ↔ Twitter balance: fast-scrolling
timeline (Twitter) where every entry is a real, actionable object (Reddit-grade
anchored discussion one tap away). Today items never appear in the timeline as
first-class cards, activity rows are inert one-liners, the follow-filter is an
invisible magic-`5` fallback, and the feed hard-caps at 50 with no pagination.

## Scope
- **Items enter the timeline**: newly published evaluations appear as rich feed
  cards (cover strip, verdict badge, score, tagline, category chips) with the
  same action row as posts (vote, comments count → item discussion, repost).
- **Activities carry their object**: repost rows embed the reposted post/item
  card (with quote text when present); "added X to their stack" embeds a compact
  item chip + the take. No more dead one-liners.
- **Following / Everyone toggle**: explicit tabs at the top of the feed
  (persisted in URL `?feed=following|all`). Following tab shows the circle's
  content with a real empty state ("follow people to fill this") — remove the
  silent ≥5 global fallback.
- **Cursor pagination**: unified `createdAt` cursor across posts + activities +
  item cards; "Load more" button (server component + searchParam or route
  handler). No hard 50 cap.
- **Hero collapses for signed-in users**: returning users get the timeline at
  the top (compact one-line brand bar instead); full hero only for logged-out
  visitors. Feed-first like Twitter, not landing-page-first.

## Acceptance
- A published item renders as a feed card with working vote/repost actions.
- A repost with a quote shows the quote and the embedded original.
- Toggle switches Following/Everyone, survives reload via URL, has an empty state.
- "Load more" fetches the next page; entries stay in strict time order.
- Signed-in home shows the feed above the fold (hero gone/collapsed).
