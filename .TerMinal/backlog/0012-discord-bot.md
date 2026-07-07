---
id: 012
title: "Discord bot: daily digest, link submissions, lookups"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ADR-0002, ARCH]
depends_on: [0006]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

discord.js bot: daily digest of new evals to a channel, /submit <url> enqueues via internal API, /eval <query> looks up an evaluation. Own deployment.

## Acceptance
- /submit enqueues a submission the scanner later drains; daily digest posts new items.
