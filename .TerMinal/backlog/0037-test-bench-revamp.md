---
id: 37
title: "UX revamp: the \"Test Bench\" design system + modern directory refactor"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ARCH]
depends_on: [0032, 0036]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Full visual revamp (user request, /frontend-design). Concept: AIx as a
measurement instrument — "The Test Bench".

- Theme: cool porcelain / slate-night canvases, blue-black ink, one
  calibration-cobalt accent; verdicts as sharp inspection stamps.
- Type: Archivo (display) · Instrument Sans (body) · IBM Plex Mono (data),
  via next/font.
- Signature: SegMeter — a ten-segment bargraph that renders every 0-100
  score (rows, scorecard, audience fit, spec rail).
- Refactor: directory = dense scannable rows (logo · name · stamp · tagline ·
  uses/comments · meter+score); item page = main column + sticky spec rail
  ("Readout" + "In the field" panels); filters = search-first control strip.

## Acceptance
- Both themes coherent; e2e suite green; no page renders old ember/cream.
