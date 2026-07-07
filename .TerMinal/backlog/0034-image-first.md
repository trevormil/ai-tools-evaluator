---
id: 34
title: "Image-first: every post requires an image; visual-forward cards"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0004]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Everything on AIx carries an image/logo. SUPERSEDED IN PART by 0036: generic
posts are removed as a composable object, so "no posts without an image" is
satisfied structurally — every remaining card is anchored to a tool, and
every tool carries a logo/cover.

## Scope (post-0036)
- Every item has an image from the moment it exists: instant logo for user
  submissions (GitHub owner avatar for repos, branded placeholder otherwise —
  lands with 0035), scanner media pipeline for scored items.
- Cards lead with the image: take cards + feed entries show the tool logo;
  directory cards keep the 16:9 cover with a better monogram fallback.
- If standalone posts ever return, they require an image (parked).

## Acceptance
- No card on /, /activity, /item, or profiles renders without an image/logo.
- Fresh submissions get a visible logo immediately.
