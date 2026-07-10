---
id: 052
title: "Eval lenses stage 3: Claude/agent Skills source (agent-tool lens)"
status: open
priority: high
horizon: next
hitl: false
type: feature
source: manual
created: 2026-07-10
updated: 2026-07-10
prs: []
refs: [ADR-0003]
depends_on: [051]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Stage 3 of ADR-0003. Add **Claude/agent skills** (skills, slash-commands,
subagents, plugins) as a discovery source. Reuses the existing `agent-tool` lens,
so it's the lowest-friction expansion and closest to the core audience.

- Add `skill` to `ITEM_KINDS`; map `skill → agent-tool` in `KIND_LENS`.
- New `apps/scanner/src/sources/skills.ts` implementing `DiscoverySource`
  (`discoverTrending?` + `resolveUrl`) — decide the registry/source of truth
  (e.g. skills marketplaces, curated lists, GitHub skill repos).
- Per-source ranking + quality gate (star velocity doesn't apply the same way).
- `ItemSource` gains any skill-specific optional signals needed.

Verify: a dry-run publishes a skill evaluated through the agent-tool lens; source
tests cover discovery + URL resolution.
