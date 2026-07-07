---
id: 20
title: "My Workflow tab + long-form markdown articles"
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
depends_on: [0004, 0018]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Profiles become tabbed hubs (Posts · My Stack · My Workflow · Articles).

## Scope
- **Long-form markdown articles**: `articles` table (id, authorId, slug, title,
  bodyMd, createdAt, updatedAt). Compose/edit UI; article page renders SAFE
  markdown (markdown-it html:false or sanitized). Listed on profile "Articles".
- **My Workflow tab**: per-user, either an EXTERNAL LINK (users.workflowUrl) or a
  long-form article (users.workflowArticleId). Owner editor to set it. Renders
  the article inline (markdown) or shows the external link.
- Markdown rendering must be XSS-safe (no raw HTML / javascript: links).

## Acceptance
- A user can write a markdown article; it renders safely on its own page.
- My Workflow shows either the linked article or the external URL; owner can edit.
- Profile has tabbed sections.
