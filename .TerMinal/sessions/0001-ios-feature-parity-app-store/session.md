---
id: 0001
slug: ios-feature-parity-app-store
anchor: SES-0001
title: "iOS feature parity + App Store readiness"
status: active
started: 2026-07-20T09:34
ended: null
goal: "iOS app feature parity with web + App Store submission readiness (server mobile-auth + v1 social read APIs, SwiftUI social features, store assets)"
tickets: ["057", "058", "059", "060", "061", "062", "063"]
branches: []
prs: []
related_research: []
related_docs:
  - docs/architecture.md
  - docs/internal-api.md
  - docs/public-api.md
  - docs/decisions/0002-aix-stack.md
  - ios/README.md
prior_sessions: []
---

# SES-0001 — iOS feature parity + App Store readiness

## [1] Goal

Take the existing read-only `ios/` SwiftUI app to full feature parity with
`aix.trevormil.com` and make it App Store submission ready. Requires server
work first (mobile auth, v1 social read APIs), then iOS feature build-out,
then store assets/manifest/runbook.

## [2] Context & pointers

- **Existing iOS app** (`ios/`): XcodeGen (`project.yml`, xcodeproj committed),
  SwiftUI iOS 17+, zero deps. Covers Directory, Item Detail (eval/scorecard),
  Leaderboard (`sort=top` only), Settings. No tests, no auth, no icon,
  `CODE_SIGNING_ALLOWED: NO`.
- **Auth today is browser-only**: GitHub OAuth → `aix_session` httpOnly cookie;
  sessions are opaque tokens in `sessions` table (`apps/web/lib/auth.ts`).
  Dev login `/api/auth/dev?u=x` gated by `AIX_DEV_LOGIN=1`.
- **JSON surface today**: public read `/api/v1/{items,items/[slug],dump}`;
  cookie-authed writes (`/api/{comments,votes,follows,stack,reposts,messages,
  notifications,profile,rescore,submissions}`); `/api/feed` (viewer via
  cookie); internal bearer `/api/internal/*`. Social reads (takes, comments,
  profiles, leaderboard, recap) are server-component-only — no JSON.
- **Single-writer SQLite** on PVC; web pod is the only DB owner. All iOS
  traffic goes through `https://aix.trevormil.com` HTTP APIs — no new infra.
- **Web page references for parity**: `apps/web/app/page.tsx` (feed),
  `item/[slug]/page.tsx` (tabs/readout), `/submit`, `/u/[username]`,
  `/messages*`, `/notifications`, `/recap*`, `/leaderboard`.
- **In flight elsewhere**: PR #52 (static pivot) is parked — do not touch.
  Open tickets 054–056 (scanner/evaluator) are unrelated.
- **Plan**: single feature branch `feat/ios-parity`, one PR closing 057–063
  (repo convention: batch cohesive tickets; review is the bottleneck).
  0064 (admin surface) filed as `future`.

## [3] Checklist

- [ ] 057 — write failing route tests: bearer-token session resolution, `?client=ios` OAuth hand-off redirect, bearer logout
- [ ] 057 — implement bearer auth + mobile OAuth hand-off to make tests pass
- [ ] 058 — write failing route tests: v1 item social, user profile, leaderboard, recap(+date/archive), feed bearer mode
- [ ] 058 — implement v1 social read endpoints; update docs/public-api.md
- [ ] 059 — add AIxTests target to project.yml; write failing decoding/APIClient/AuthStore tests
- [ ] 059 — implement Keychain AuthStore, ASWebAuthenticationSession sign-in, bearer APIClient
- [ ] 060 — Feed tab + item social tabs (takes, discussion, votes, I-use-this, repost, rescore) with VM tests
- [ ] 061 — Submit tab + profiles/follows/stack with VM tests
- [ ] 062 — Notifications, DMs, recap, 3-list leaderboard with VM tests
- [ ] 063 — App icon, privacy manifest, Info.plist store config, signing prep, submission runbook
- [ ] verify — bun test + typecheck green; xcodebuild test green; Release sim build green
- [ ] open PR closing 057–063; link PR into each ticket's prs:

## [4] Log

- 2026-07-20 09:34 — session opened; recon complete (web feature inventory, existing ios/ audit); tickets 057–064 filed.

## [5] Decisions

- Mobile auth = bearer acceptance of existing opaque session tokens + custom-scheme OAuth hand-off (no new token format, no refresh flow).
- Social reads go under public `/api/v1/*` (data is public on web; viewer fields light up with bearer).
- One PR for 057–063; 064 (admin) parked as future.
- No push notifications in v1 (in-app inbox only); no avatar upload in v1.

## [6] Outcomes

_(session-end)_

## [7] Follow-ups

_(session-end)_

## [8] Retro

_(session-end)_
