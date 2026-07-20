---
id: 0001
slug: ios-feature-parity-app-store
anchor: SES-0001
title: "iOS read-only browse app + App Store readiness"
status: ended
started: 2026-07-20T09:34
ended: 2026-07-20T13:30
goal: "iOS app feature parity with web + App Store submission readiness (server mobile-auth + v1 social read APIs, SwiftUI social features, store assets)"
tickets: ["058", "059", "060", "062", "063", "065", "067", "068"]
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
- [x] code-review agent to the merge bar — **approve**, 0 findings, 268/268
      tests (artifact: autopilot-harness prs/…/56/8418f27.md); 0069 filed
      from the reviewer's CI suggestion
- [x] human merged #56 (and the follow-up UX/feature PRs #58–#66) → each
      auto-deployed (CI image build + rollout restart) → merge-sync'd

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
- 2026-07-20 10:45 — Trevor UX pass: real web logo for the icon (funnel mark
  reproduced in CoreGraphics), Leaderboard removed end-to-end (tab + v1
  endpoint), Recap folded into a feed strip (3 tabs: Feed/Directory/
  Settings), feed cards image-forward, brand-blue accent. All suites green.
- 2026-07-20 10:50 — more UX: chevrons removed, feed rows = directory rows
  (shared ItemRow), sort menu alignment fixed, category dropped, taglines
  footnote + 5-line clamp. App deployed to Trevor's physical iPhone 16 via
  devicectl (team passed at build time, not committed).
- 2026-07-20 11:05 — 0067 Trending tab (GitHub search-API proxy + PH GraphQL
  proxy, cached 30 min; iOS source/window segments) and 0068 Favorites tab
  (device-local bookmarks + pasted-links reading list). Server 137 tests,
  iOS 30 tests, all green. Reinstalled on iPhone.
- 2026-07-20 11:20–12:40 — rapid ship loop with Trevor merging (#56 review
  approve 0 findings; then review waived for UX follow-ups #58–#61):
  full GFM READMEs (GitHub-rendered HTML + markdown-it), Trending→Browse,
  0071 HN + HF sources (+ HN in-app discussions, HF model cards), 0072
  Spotlight (share extension parked: free team can't provision App Groups),
  Feed+Browse unified behind source chips (AIx · GitHub · PH · HN · 🤗,
  official Octocat mark), crisp thumbnail item headers. Each merge
  auto-deployed via CI image build + rollout restart; endpoints verified
  live. TestFlight HITL open (paid Apple enrollment).

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

- **The AIx iOS app shipped end-to-end in one day**: read-only browse client
  with a unified Browse tab (source chips AIx · GitHub · Product Hunt ·
  Hacker News · 🤗), Directory, Favorites (device-local bookmarks + saved
  links, Spotlight-indexed), Settings, and a daily-pick local notification.
  In-app rich content everywhere: GFM READMEs (GitHub-rendered HTML), HF
  model cards (normalized + rendered), HN post + comments, PH stories with
  screenshots. Real brand badges (official Octocat mark), real cover
  imagery (pickCover pipeline, 58/99 genuine + monogram tiles).
- **Server**: public v1 read APIs (recap, daily-pick, trending ×4 sources
  incl. README/model-card/HN-item proxies, all cached), cover-quality
  pipeline + idempotent backfill. Zero auth surface (mobile-auth built then
  reverted on rescope).
- **App Store readiness**: icon from the real site logo, privacy manifest
  (no data collected), store-ready Info.plist, archive verified, submission
  runbook (docs/runbooks/ios-app-store-submission.md).
- **Merged PRs**: #56 (review: approve, 0 findings, 268/268) then #57, #58,
  #59, #60, #61, #62, #63, #64, #65, #66 (review waived by Trevor for UX
  follow-ups). All deployed to aix.trevormil.com; app installed on Trevor's
  iPhone 16 throughout via devicectl.
- **Tests at close**: 148 server (bun) · 36 iOS (XCTest) · all green.

## [7] Follow-ups

- **HITL (open)**: Apple Developer Program enrollment + ASC API key →
  unblocks TestFlight (archive already verified) and the share extension
  (code + tests done, target parked in project.yml; App Groups need paid
  provisioning). Runbook ready.
- **0066 (open, high)**: seed schema drift breaks the Playwright e2e suite
  on main — next real bug.
- **0069 (future)**: iOS XCTest job in CI (macOS runner, paths-gated).
- Icebox: 057 (mobile auth), 061 (submit/profiles), 064 (admin surface).

## [8] Retro

- The mid-session rescope (full social parity → read-only browser) was
  caught early enough that the revert was clean; building the auth surface
  first was wasted motion — a scope check on "feature parity" before
  building would have saved ~40 min.
- Merge-watch monitors + CI-image + rollout-restart made a tight
  human-merge/agent-deploy loop (10 PRs shipped same-day).
- Two misdiagnoses worth remembering: "placeholder faces" meant TWO things
  (selfie covers on AIx items AND the repeated 🤗 source badge on HF rows)
  — ask which screen before fixing; and ticket files must ride the SAME PR
  as their code or they strand on squash-merged branches (0070 lesson).
