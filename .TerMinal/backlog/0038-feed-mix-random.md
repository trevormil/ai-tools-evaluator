---
id: 38
title: "Feed mix: discussions as content; Random mode (pick one, learn it)"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ARCH]
depends_on: [0024, 0036]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Two asks from the user:

1. **The main feed (/activity) mixes new products, new takes, AND
   discussions.** Products + takes are already first-class; comment
   activity is a dead label ("commented on X"). Make discussion entries
   carry the comment body + the tool context as an embedded card.
2. **Random mode**: a "pick one at random" affordance — /random routes to a
   random published (scored-first) tool page so you can just learn one.
   Entry points: home header + desktop nav.

## Acceptance
- A comment on an item shows in /activity with the comment text embedded.
- /random 307s to a random /item/<slug>; button on home + nav link.
- e2e covers both.
