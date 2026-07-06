---
id: 014
title: "CI/CD: Dockerfiles + GHCR build/push workflow"
status: open
priority: high
horizon: now
hitl: false
type: dx
source: manual
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0002,0010,0012]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Multi-stage bun Dockerfiles for web, scanner, bot. GH Actions builds + pushes ghcr.io/trevormil/aix-{web,scanner,bot}:latest + sha on main. Pin bases.

## Acceptance
- Images build locally; CI pushes tagged images to GHCR.
