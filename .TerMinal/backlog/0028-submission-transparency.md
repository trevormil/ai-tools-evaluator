---
id: 28
title: "Submission transparency + honest directory counts"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0007]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

- **Submission reasons are hidden**: DB models `reason` + statuses
  duplicate/rejected/failed, but profile + submit pages render a bare status
  chip. A rejected submitter never learns why. Render the reason; persist
  duplicate submissions as `duplicate` rows (today dupes get a 200 and no row,
  so they vanish).
- **Directory count lies past 60**: "{n} results" shows the capped page size,
  not the real total. Add `count(*)` + "Load more" (offset or cursor) to the
  directory.

## Acceptance
- Rejected/duplicate submissions show status AND reason on /submit and profile.
- Directory shows the true total and can page past 60.
