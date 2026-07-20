---
id: 071
title: "Trending sources: HackerNews (Show HN, AI-filtered) + Hugging Face models"
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
  - "GET /api/v1/trending/hackernews?window=daily|weekly returns Show-HN stories via the public Algolia API, filtered to AI-relevant titles (topped up when the filter over-prunes), with points/comments/author/urls"
  - "GET /api/v1/trending/huggingface returns trending models via the public HF API (id, likes, downloads, pipeline tag, tags); no auth, window ignored (HF trending is inherently recent)"
  - "GET /api/v1/trending/huggingface/readme?model=owner/name returns the model card rendered to HTML (YAML frontmatter stripped, markdown-it)"
  - "iOS Trending tab: four sources ordered GitHub · Product Hunt · HN · HF; window menu hidden for HF; HN detail shows the GitHub README in-app when the story links a repo; HF detail shows the model card; both save-able to Favorites"
  - "Route + VM + decoding tests with mocked upstreams"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Two more account-free discovery lenses next to GitHub/PH. HN rides the public
Algolia search API (no token) with the Show HN tag + a window filter, filtered
by the same AI-affinity keywords the scanner ranks with; HF trending uses the
public hub API. Both proxied + cached server-side like the existing sources.
