---
id: 25
title: "Inline engagement: reply from the feed, quote-repost composer"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0024]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Twitter-side of the balance: acting on content must not require a page
navigation. Today every comment requires visiting `/post/[id]`, and quote
reposts are half-built (DB column + API param exist; no compose UI, quote never
displayed).

## Scope
- **Inline reply**: a Reply affordance on feed post cards expands a one-line
  composer in place (client component calling POST /api/comments), optimistic
  count bump, link to the full thread for depth. Reddit depth stays one tap away
  on `/post/[id]`.
- **Quote repost**: repost button becomes a two-option affordance (Repost /
  Quote). Quote opens a small composer; POST /api/reposts with `quote`. Feed
  renders quote text above the embedded original (ties into 0024's rich
  activity rendering).

## Acceptance
- Reply posted from the home feed without navigation; appears in the thread.
- Quote repost composed from the feed; quote text visible in followers' feed.
- Both gated on session with sign-in prompt when logged out.
