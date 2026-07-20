---
id: 061
title: "iOS: Submit tab + profiles, follows, My Stack"
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
  - "Submit tab: URL + note form posting to /api/submissions; my-submissions list with status badges; sign-in gate"
  - "Profile screen (/u parity): avatar, bio, follower/following counts, links; tabs Takes / My Stack / Activity"
  - "Follow/unfollow button on other users; edit displayName/bio on self"
  - "My Stack management: add/edit/remove stack entries with status + rating"
  - "ViewModel unit tests for submission flow, follow toggle, and stack CRUD (mocked client)"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Web reference: `/submit` (SubmitForm, SubmissionRow), `/u/[username]`
(TakeCard, StackSection, ActivityCard, FollowButton, EditProfile). Reads from
0058's profile endpoint; writes via `/api/submissions`, `/api/follows`,
`/api/stack`, `/api/profile` with bearer auth. Avatar upload is out of scope
for v1 (multipart + storage config) — note it in the profile editor.
