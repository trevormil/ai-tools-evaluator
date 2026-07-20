---
id: 060
title: "iOS: Feed tab + item detail social parity (takes, comments, votes, I-use-this, repost, rescore)"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: ["058", "059"]
acceptance:
  - "Feed tab: Everything/Following segments, cursor pagination, pull-to-refresh; Following gated on sign-in"
  - "Item detail gains Takes and Discussion tabs: take composer (status + rating + blurb), nested comments with reply, both posting via existing write APIs"
  - "Vote buttons, I-use-this toggle, repost, share sheet, and request-rescore wired on item detail"
  - "Evaluation tab renders lens-specific sections + audience-fit meters; Scorecard renders all 10 metrics with rationales; README tab renders markdown"
  - "Pending items show 'Awaiting score…' state matching web"
  - "ViewModel unit tests for feed pagination, take/comment posting, and vote toggling (mocked client)"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Bring the two richest web surfaces to iOS: the home feed and the full item
page. Web reference: `apps/web/app/page.tsx` (FeedTabs/FeedList) and
`apps/web/app/item/[slug]/page.tsx` (ContentTabs, VoteButtons, TakeComposer,
CommentThread, readout rail). Reads come from 0058's endpoints; writes reuse
the existing cookie-authed JSON endpoints via bearer (0057).
