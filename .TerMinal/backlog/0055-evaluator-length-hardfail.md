---
id: 055
title: "Evaluator robustness: over-length model output hard-fails scoring"
status: open
priority: high
horizon: now
hitl: false
type: bug
source: manual
created: 2026-07-10
updated: 2026-07-10
prs: []
refs: []
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Observed in a live dry-run smoke test (2026-07-10): the cheap evaluator model
(`deepseek/deepseek-v4-flash`) sometimes returns fields over their schema bounds
— e.g. `tagline` > 160 chars, `decision.insteadOf` > 120 — and the repair loop
gives up after 3 attempts:

```
evaluator failed for simonlin1212/Vibe-Research after 3 attempts:
  tagline: String must contain at most 160 character(s)
  decision.insteadOf: String must contain at most 120 character(s)
```

Impact: any item that trips this is **never scored** — a trending item is
skipped, and a *queued submission* is marked `failed`. Likely a contributor to
queue items not getting scored (see the colibri incident).

Fixes to consider:
- Deterministically clamp obviously-truncatable string fields (tagline,
  insteadOf, rationales) to their max before/at validation, instead of failing.
- Make the repair prompt name the exact offending field + limit (it already
  passes the zod issues; tighten the instruction to "shorten X to <=N chars").
- Bump `maxRetries`, and/or fall back to a more reliable model on repeated
  length failures.

Also harden `runDry` (scanner `index.ts`): unlike the real run loop, the dry-run
path does NOT wrap `evaluate()` in try/catch, so a single bad eval aborts the
whole dry run. Wrap it so a dry run skips-and-continues like production.
