---
id: 26
title: "Item page social surface: posts about it, who runs it, repost/share"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ADR-0002, ARCH]
depends_on: [0018, 0019]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Reddit-side of the balance: the item page is the anchored-discussion home for a
tool, but today it is socially dead — no posts about the item, no stack signal
("N engineers run this" was ticket 0018 phase 2 and never shipped), and no
repost button even though `/api/reposts` fully supports `targetType:"item"`.

## Scope
- **Posts about this item**: section on `/item/[slug]` listing posts with
  `posts.itemId = item.id` (PostCard reuse), plus a "Post about this" composer
  affordance that pre-attaches the item.
- **Who runs it**: "N engineers run this" count from `stack_items` by status,
  surfacing a few takes (username + status + take snippet) linking to profiles.
- **Repost/share row**: RepostButton (`targetType:"item"`) in the item header
  next to votes.

## Acceptance
- Posts attached to an item render on its page; composer pre-attaches the item.
- Stack count + takes render when stack entries exist (hidden when zero).
- Item repost lands in followers' feeds as a rich embedded card (per 0024).
