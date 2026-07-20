---
id: 0001
slug: ios-feature-parity-app-store
anchor: SES-0001
title: "iOS read-only browse app + App Store readiness"
status: active
started: 2026-07-20T09:34
ended: null
goal: "iOS app feature parity with web + App Store submission readiness (server mobile-auth + v1 social read APIs, SwiftUI social features, store assets)"
tickets: ["058", "059", "060", "062", "063", "065"]
branches: ["feat/ios-parity"]
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/56"]
related_research: []
related_docs:
  - docs/architecture.md
  - docs/public-api.md
  - docs/decisions/0002-aix-stack.md
  - ios/README.md
prior_sessions: []
---

# SES-0001 — iOS read-only browse app + App Store readiness

## [1] Goal

Original goal (verbatim above): full feature parity incl. social + accounts.
**Rescoped mid-session by Trevor ([4] 10:05):** the app must be a read-only
browse client — feed, directory, evaluations, leaderboard, recap — with a
daily local notification for the daily pick. Zero social features, zero
accounts. App Store submission readiness still in scope.

## [2] Context & pointers

- **iOS app** (`ios/`): XcodeGen (`project.yml`), SwiftUI iOS 17+, zero deps,
  AIxTests unit target (`xcodebuild test`, iPhone 17 sim). Tabs: Feed,
  Directory, Leaderboard, Recap, Settings.
- **Server surface the app uses** (all public, read-only, CORS):
  `/api/v1/items[, /slug]` (detail now includes `readmeMd`),
  `/api/v1/leaderboard`, `/api/v1/recap[/date|/archive]`,
  `/api/v1/daily-pick` (new), and anonymous `/api/feed` (already existed).
- **Notification**: local-only repeating 9am `UNCalendarNotificationTrigger`
  (`ios/AIx/Notifications/DailyPickReminder.swift`); tap resolves the current
  pick via `/api/v1/daily-pick` and deep-links via `AppRouter`.
- **In flight elsewhere**: PR #52 (static pivot) parked — do not touch.
- **Plan**: single branch `feat/ios-parity`, one PR closing 058/059/060/062/
  063/065. 057/061/064 iceboxed (descoped).

## [3] Checklist

- [x] 058 — route tests + v1 leaderboard/recap endpoints
- [x] 058 — daily-pick endpoint + readmeMd on item detail (tests first)
- [x] 059 — AIxTests target; decoding + APIClient tests; read-only client
- [x] 060 — read-only Feed tab (+ Today's pick card) + item detail tabs, VM tests
- [x] 062 — three-list leaderboard + recap browser
- [x] 065 — daily-pick reminder (scheduler tests + Settings toggle + deep link)
- [x] 063 — app icon, launch screen, privacy manifest, Info.plist store config, signing prep, submission runbook
- [x] verify — bun test (133) + typecheck + prettier green; xcodebuild test (21) green; Release sim build green; live smoke test vs prod in simulator
- [x] open PR #56 closing 058/059/060/062/063/065; PR linked into each ticket's prs:
- [ ] code-review agent to the merge bar → human merges → /merge-sync

## [4] Log

- 2026-07-20 09:34 — session opened; recon complete; tickets 057–064 filed.
- 2026-07-20 09:40 — 057 mobile auth built (bearer + aix:// hand-off), green.
- 2026-07-20 09:50 — 058 social read APIs built, green. /api/me + GET
  /api/submissions added. 059 iOS auth foundation green (21 tests).
- 2026-07-20 10:05 — **Trevor rescoped: read-only app, no social/accounts,
  daily-pick notification.** Reverted 057 + social endpoints + /api/me +
  GET /api/submissions + all iOS auth/social code. Kept leaderboard/recap
  endpoints; added /api/v1/daily-pick + readmeMd on item detail.
- 2026-07-20 10:20 — read-only rebuild green: server 133+ tests, iOS 21 tests.
  Tickets reconciled (057/061/064 icebox; 058/059/060/062 rescoped; 065 new).
- 2026-07-20 10:27 — 063 done (icon, privacy manifest, runbook); Release build
  green; app smoke-tested in simulator against prod (feed renders live data).
- 2026-07-20 10:30 — Playwright e2e found broken on main (seed schema drift)
  → filed 0066; not a branch regression. Pushed; **PR #56 opened**, linked
  into tickets 058/059/060/062/063/065.

## [5] Decisions

- App is a **read-only browser**: all writes/accounts stay on the website.
  Server keeps zero mobile-auth surface (057 reverted pre-merge).
- New read endpoints live under public `/api/v1` next to the existing ones;
  the anonymous `/api/feed` is reused as-is for the timeline.
- Daily pick reminder is **local-only** (repeating 9am calendar trigger with
  static copy; tap resolves the live pick at open time). APNs push = future
  ticket if ever wanted.
- One PR for 058/059/060/062/063/065.

## [6] Outcomes

_(session-end)_

## [7] Follow-ups

_(session-end)_

## [8] Retro

_(session-end)_
