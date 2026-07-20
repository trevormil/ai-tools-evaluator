---
id: 067
title: "Trending tab: GitHub + Product Hunt, today / this week (server proxy + iOS)"
status: in-progress
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/56"]
refs: []
depends_on: ["059"]
acceptance:
  - "GET /api/v1/trending/github?window=daily|weekly returns young repos ranked by stars (official search API, no scraping); GITHUB_TOKEN used when present"
  - "GET /api/v1/trending/producthunt?window=daily|weekly returns posts ranked by votes via the PH GraphQL API; 503 with a clear error when PRODUCTHUNT_API_TOKEN is unset"
  - "Responses are cached in-memory (~30 min per source+window) so browsing never hammers upstream rate limits"
  - "Route tests (bun test) with mocked fetch: query construction, caching, invalid window 400, PH-unconfigured 503"
  - "iOS Trending tab: source segment (GitHub / Product Hunt) + window segment (Today / This Week); rows open the upstream page; VM + decoding tests"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Browse what's rising right now, next to what AIx has judged. Upstream
constraints decide the shape: github.com/trending has no official API (we
approximate with the search API — young repos by stars, same approach the
scanner uses), and Product Hunt's GraphQL needs a server-side developer
token — so both are proxied through small cached `/api/v1/trending/*`
endpoints rather than fetched from the device. The web pod already inherits
both tokens via `envFrom: aix-secrets`; no k8s changes.
