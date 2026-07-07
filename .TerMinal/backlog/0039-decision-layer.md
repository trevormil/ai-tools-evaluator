---
id: 39
title: "Decision layer: install one-liner, adopt-if/skip-if, health facts, integration schematic"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: []
refs: [ARCH]
depends_on: [0037]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Make adopt-or-skip decidable on the item page in one look — kill the noise.

## Scope
- **Schema (optional, backward-compatible)**: `Evaluation.quickstart`
  { install (the exact one-liner), requires[] (API key, account, Docker…) }
  and `Evaluation.decision` { adoptIf[], skipIf[], insteadOf? }. Evaluator
  prompt updated to extract them from the README.
- **Item page "Make the call" panel** (spec rail, above the fold): install
  command with copy button, requires chips, adopt-if/skip-if bullets,
  "instead of X" line.
- **Health facts**: language · license · last-push recency · stars — already
  captured in source, now displayed in the rail.
- **Integration schematic**: a small SVG "where it sits in your stack"
  diagram keyed off the integration kind (skill/plugin/mcp/library/
  standalone/workflow-shift) — deterministic, no model call.
- **Shuffle deck**: cards show the install one-liner when present.
- Seeds carry quickstart+decision for a few tools so surfaces render.

## Acceptance
- Old evaluations (no new blocks) parse + render unchanged.
- ripgrep page shows install + copy, adopt-if/skip-if, health facts,
  schematic; e2e covers it.
