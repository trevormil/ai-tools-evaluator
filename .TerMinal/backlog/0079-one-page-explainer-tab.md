---
id: 79
title: "Add an AI-generated one-page explainer as a new site tab"
status: in-progress
priority: medium
horizon: next
hitl: false
type: feature
source: manual
created: 2026-08-01
updated: 2026-08-02
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/85"]
refs: []
depends_on: []
acceptance:
  - "A new top-level tab (e.g. 'About' / 'How it works') is reachable from the site nav and renders a one-page explainer"
  - "The explainer covers: what AIx is (directory + social for trending AI tools/papers), the problem it solves, how the pipeline works (scan -> evaluate -> scorecard -> daily pick), and what AIx is / is not"
  - "Visual, infographic-style layout (sections, icons/diagrams, flow steps) — not a wall of text; styled with the site's existing Tailwind theme, responsive on mobile"
  - "Content is a static asset/component (no DB or runtime AI calls); regenerating it is a code change, not a runtime feature"
  - "e2e: navigating to the tab from the home page renders the explainer with its section headings present"
agent_id: 1000x-ai-engineer
agent_scope: repo
agent_kind: classic
---

Invest in a one-page explainer / infographic for AIx, generated with AI
(design + copy), and surface it as a new tab on the site.

Reference for the desired format: the QM (Quartermaster) one-pager — a dense,
sectioned infographic with a hero (logo + tagline), "The Problem", "How it
works" (numbered pipeline steps), feature panels, and a "What it is / what it
is NOT" closer. Saved reference image:
`~/.claude/image-cache/3359e98e-62a3-4de0-be15-b28729564a71/1.png`.

For AIx the equivalent sections would be roughly: the problem (AI tool
firehose, hype vs substance), the pipeline (daily multi-source scan, cap
10/day + dedup, strict 10-metric AI scorecard, forced verdict +
"is this just complexity?" devil's-advocate, daily pick, link-drop queue),
and what AIx is / is not (harshly-honest directory, not a popularity chart).

Format is open — a single scrollable infographic page is the default; a slide
deck is acceptable if it renders well in-site. Prefer whatever the generation
workflow produces best. Design-heavy: use the `frontend-design` skill (or
`landing-page` patterns) when implementing.
