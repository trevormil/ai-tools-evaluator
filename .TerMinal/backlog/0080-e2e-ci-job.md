---
id: 080
title: "CI: run the Playwright e2e suite on PRs so it can't go dark again"
status: open
priority: medium
horizon: next
hitl: false
type: chore
source: manual
created: 2026-08-02
updated: 2026-08-02
prs: []
refs: ["074"]
depends_on: ["074"]
acceptance:
  - "A GitHub Actions job runs bun run test:e2e on every PR"
  - "The job fails the check when any spec fails"
  - "Runtime stays reasonable (build cache or ~5 min budget documented)"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Root cause of 0074 was that the e2e suite ran nowhere: 14 specs rotted
unnoticed while the app moved. Once 0074 lands green, add a CI job (alongside
the existing unit-test workflow, if any) that runs `bun run test:e2e` —
Playwright + a seeded production build — on every PR, so drift is caught at
review time instead of archaeologically.
