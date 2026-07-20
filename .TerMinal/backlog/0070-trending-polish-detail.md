---
id: 070
title: "Trending polish: logos, weekly default, in-app repo/product detail + README proxy"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: ["067"]
acceptance:
  - "Trending payloads enriched (GitHub avatars/forks/issues/topics/license/homepage; PH thumbnail/description/comments/website/media)"
  - "GET /api/v1/trending/github/readme?repo=owner/name proxies the raw README (cached, 400 on malformed repo, null when absent)"
  - "iOS: thumbnails on rows, This Week default, 5-line clamps, in-app detail screens with save-to-favorites"
  - "Pull-to-refresh no longer cancels: list stays mounted, cancellations swallowed (Trending + Feed)"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Filed retroactively for the record (code comments reference 0070): Trevor's
follow-up UX pass on the Trending tab, shipped in PR #58 (merged + deployed
2026-07-20). Code review intentionally waived by Trevor for this UX-only
follow-up; server + iOS suites green (140 / 31).
