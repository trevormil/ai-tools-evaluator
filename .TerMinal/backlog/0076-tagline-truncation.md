---
id: 76
title: "Taglines near the 160-char cap end mid-sentence (visible in App Store screenshots)"
status: in-progress
priority: medium
horizon: now
hitl: false
type: bug
source: manual
created: 2026-07-21
updated: 2026-08-02
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/82"]
refs: []
depends_on: []
acceptance:
  - "A check rejects taglines that do not end in terminal punctuation"
  - "Existing truncated taglines are regenerated or repaired (qdrant-qdrant at minimum)"
  - "A test covers the new constraint"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

`qdrant-qdrant`'s tagline is 153 chars and reads:

> The de facto vector database for production RAG and semantic search – a
> Rust-based engine with rich filtering, quantization, and distributed scaling
> **that**

It just stops. `packages/core/src/schema.ts:143` allows `min(10).max(160)`, and
nothing in `apps/` truncates evaluation taglines — so the model generated a
sentence it could not finish inside the cap and the value passed validation
because length was the only thing checked.

Caught while capturing App Store screenshots: the broken tagline renders on the
Browse card, the Directory row, AND the item detail header, so it appears in
three of the four listing screenshots. It reads as a bug to anyone looking.

Fix: constrain generation (give the model the hard cap and require a complete
sentence well inside it) and validate that a tagline ends in terminal
punctuation, so a truncated one fails instead of silently shipping. Then repair
the stored rows. Scan for other items near the cap — `LEANN` is also 153 chars
but ends cleanly, so length alone is not the signal.
