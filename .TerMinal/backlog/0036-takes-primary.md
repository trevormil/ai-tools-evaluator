---
id: 36
title: "Takes are the social primitive — @user's take per tool, not generic posts"
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
depends_on: [0018, 0032]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

The loop is: submit a tool → like it / comment / ADD YOUR TAKE. A take is
@user's blurb on how they use a tool / what they think — it IS a stack entry
(stack_items.take), elevated to the primary social object. Generic free-form
posts are demoted: composer removed from all surfaces (legacy posts still
render; /post permalinks keep working).

## Scope
- **Item page "Takes" section** (replaces "Posts about this" + merges "In the
  wild"): all takes on the tool, takes from people you follow first, then
  newest. Each take: avatar, @user, status chip, optional ★rating, blurb.
  "Add your take" composer (status + text + rating) upserting via /api/stack.
- **Feed**: /activity = new tools + new takes (+ legacy activity). Take
  entries labeled "@user's take on <tool>" with the full blurb + tool logo.
- **Profiles**: tabs become Takes · My Stack · My Workflow · Articles ·
  Activity. Takes tab lists their takes as cards linking to the tools.
  (Posts tab removed; submissions block moves under Takes.)
- **Remove**: PostComposer component + POST /api/posts route (no UI creates
  posts anymore). PostCard stays for legacy rendering.

## Acceptance
- Add/edit a take from the item page; it appears in Takes, on my profile,
  and in /activity labeled as a take.
- A follower sees my take prioritized on the item page (follow-first sort).
- No surface offers a generic post composer.
