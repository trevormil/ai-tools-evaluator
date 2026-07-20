---
id: 057
title: "Mobile auth: bearer-token sessions + native OAuth hand-off"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: []
acceptance:
  - "getCurrentUser() accepts Authorization: Bearer <session token> in addition to the aix_session cookie"
  - "GET /api/auth/github?client=ios threads a mobile flag through OAuth state; callback redirects to aix://auth#token=<session token> instead of setting a cookie redirect"
  - "POST /api/auth/logout with a bearer token destroys that session"
  - "Route tests cover bearer accept/reject, mobile callback redirect, and logout"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

The iOS app needs authenticated access, but auth today is browser-only: GitHub
OAuth sets an `httpOnly` `aix_session` cookie. Sessions are already opaque
tokens in the `sessions` table — so the smallest mobile path is:

1. **Bearer support**: resolve `Authorization: Bearer <token>` to the same
   `sessions` row wherever the cookie is accepted (`getCurrentUser`). All
   existing cookie-authed write endpoints (comments, votes, follows, stack,
   reposts, messages, notifications, profile, rescore, submissions, feed)
   become mobile-usable for free.
2. **Native hand-off**: `/api/auth/github?client=ios` marks OAuth `state` as
   mobile; the callback creates the session as usual but redirects to
   `aix://auth#token=<token>` (custom scheme, token in fragment so it never
   hits logs). iOS drives this via `ASWebAuthenticationSession` and stores the
   token in the Keychain.

No new token formats, no refresh flow — same 30-day opaque session either way.
Dev login (`/api/auth/dev`, gated by `AIX_DEV_LOGIN=1`) should also support
`?client=ios` returning JSON `{token}` for simulator testing.
