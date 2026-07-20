---
id: 051
title: "Eval lenses stage 2: UI + bot fully lens-aware"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-10
updated: 2026-07-10
prs: []
refs: [ADR-0003]
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Stage 2 of the per-type evaluation lens rollout (ADR-0003). Stage 1 landed the
lens core (`packages/core/src/lenses.ts`): schema, prompt, `.md` artifact, and
the item page already render body sections from `LENS_SECTIONS[lensFor(source)]`.

This ticket finishes the surfaces so a non-`agent-tool` item reads correctly
end-to-end:

- **Spec rail / item header**: the readout already branches on `kind` (stars,
  language, "View paper ↗"). Generalize the per-lens labels (e.g. product shows
  upvotes/maker, not stars/license) driven by lens, not hardcoded GitHub fields.
- **Bot embed**: `apps/bot/src/embeds.ts` footer/labels assume the agent-tool
  frame; make the embed lens-aware (baseline wording, section it surfaces).
- **Filters/feed**: optionally expose lens as a filter facet alongside category.

Verify: render a `product`-lens and a `research`-lens item and confirm no
agent-only copy leaks; existing web/bot suites stay green.
