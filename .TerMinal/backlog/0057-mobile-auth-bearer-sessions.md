---
id: 057
title: "Mobile auth: bearer-token sessions + native OAuth hand-off"
status: icebox
priority: low
horizon: future
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

**Descoped 2026-07-20:** the iOS app is read-only (no accounts, no writes), so
no mobile auth surface is needed. An implementation existed briefly on
`feat/ios-parity` (bearer acceptance of opaque session tokens +
`?client=ios` OAuth hand-off to `aix://auth#token=…`) and was reverted before
merge. If a signed-in mobile experience is ever wanted, that approach was
sound: sessions are already opaque tokens in the `sessions` table, so bearer
resolution + an ASWebAuthenticationSession hand-off covers every existing
cookie-authed write endpoint with no new token format.
