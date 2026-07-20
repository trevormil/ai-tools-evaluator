---
id: 073
title: "Cover quality: no personal avatars/placeholders; promote README imagery"
status: closed
priority: medium
horizon: now
hitl: false
type: fix
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: []
acceptance:
  - "Publish path picks covers via pickCover(): skips personal-account avatars (owner type via cached GitHub API), placehold.co, social-preview cards, SVGs; promotes real README imagery"
  - "Idempotent internal backfill (POST /api/internal/covers) recomputes all covers; run against prod (110 scanned → 19 promoted, 66 junk covers removed across both passes)"
  - "Item detail endpoint exposes the canonical coverImageUrl; iOS list + detail render the same cover, with per-item monogram tiles when none exists"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Filed retroactively for the record (code comments reference 0073): Trevor's
report that item cards showed random faces / repeated placeholders. Shipped
across PRs #64 (sanitize + clear) and #66 (promotion + list/detail cover
consistency), both merged + deployed + backfilled 2026-07-20. Final prod
state: 58/99 items with genuine imagery, 41 monogram tiles.
