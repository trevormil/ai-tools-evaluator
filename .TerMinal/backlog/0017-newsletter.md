---
id: 017
title: "Daily email newsletter (subscribe/confirm/unsubscribe + Resend)"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0001, 0002]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

subscribers table (double opt-in). Public /api/newsletter/subscribe, /newsletter/confirm, /newsletter/unsubscribe. Internal POST /api/internal/newsletter/send renders last-24h digest and emails active subscribers via Resend free tier (log-only fallback with no key). aix-newsletter k8s CronJob (daily 15:00 UTC) drives the send. NewsletterForm on home.

## Acceptance
- Full subscribe->confirm->send->unsubscribe flow works. (verified e2e)
- No RESEND_API_KEY => emails logged, never crash.
