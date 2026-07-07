---
id: 22
title: "Profile links — GitHub, X, LinkedIn, Substack, etc (unverified)"
status: in-progress
priority: medium
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0004]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Let users add external links to their profile (not OAuth-verified — just URLs).

## Scope
- `profile_links` table (userId, kind, url); one per kind.
- Kinds: github, x, linkedin, substack, website, youtube, mastodon, bluesky, telegram.
- Owner-only editor (session-gated PUT /api/profile/links); public display with
  inline SVG icons on the profile header.

## Acceptance
- Owner can set/clear links; they render as icon links on the public profile.
- Only the owner can edit their own links. URLs validated.
