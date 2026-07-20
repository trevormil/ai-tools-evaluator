# AIx — iOS app

A native SwiftUI client (iOS 17+) for the [AIx](https://aix.trevormil.com)
directory of trending dev tools and papers — each with a harsh verdict and a
ten-metric scorecard. **Read-only by design**: the app browses; accounts and
all social actions live on the website. It consumes the public JSON API
(`/api/v1/*`) plus the anonymous `/api/feed` timeline.

## Features

- **Feed** — the unified home timeline (fresh items, posts, community
  activity with embeds), cursor-paginated with pull-to-refresh, topped by a
  **Today's pick** card (`/api/v1/daily-pick`).
- **Trending** — live GitHub + Product Hunt trending, today / this week
  (server-proxied `/api/v1/trending/*`); rows open the upstream page.
- **Directory** — searchable, filterable list (category / verdict / audience,
  sort by hot / new / top). Verdict badge, score chip, empty/error states.
- **Item detail** — cover, verdict + overall + noise, "Make the call"
  (quickstart install + adopt-if/skip-if), segmented tabs: **Evaluation**
  (lens-aware body sections + audience-fit meters), **Scorecard** (10 metric
  bars + rationale), **README** (repo's own markdown, when present). Share
  sheet links to the website.
- **Recap** — a "last night's recap" strip under the pick opens the full
  nightly recap (prev/next day navigation + date archive, `/api/v1/recap*`).
- **Daily pick reminder** — optional local notification every morning at 9;
  tapping it opens the current pick (no push infra, no data collected).
- **Settings** — reminder toggle + backend base-URL override (persisted).

## Architecture

```
AIx/
  App/            AIxApp entry + RootView (TabView) + AppRouter + Config
  Models/         Codable structs mirrored 1:1 from the API (core + feed)
  Networking/     APIClient (async/await URLSession, typed APIError)
  Notifications/  DailyPickReminder (UNUserNotificationCenter, testable seam)
  Design/         Theme (verdict & score colors, light/dark friendly)
  Components/     VerdictBadge, ScoreChip, MetricBar, ItemRow, AvatarView, …
  Features/
    Feed/         FeedView + FeedViewModel (@Observable)
    Trending/     TrendingView + TrendingViewModel (GitHub / PH panes)
    Directory/    DirectoryView + DirectoryViewModel
    Detail/       ItemDetailView + DetailViewModel (tabs, lens-aware)
    Recap/        RecapScreen + RecapViewModel (pushed from the feed strip)
    Settings/     SettingsView
AIxTests/         Unit tests: model decoding, APIClient (URLProtocol stub),
                  feed pagination/dedup, notification scheduling
```

The `Codable` models match the API's JS field names exactly (camelCase:
`overallScore`, `coverImageUrl`, `aiEngineerFit`, the 10 metric keys, etc.), so
a field-name drift on the server is the thing to check first if screens go
empty. Enum decoding is lenient (unknown verdict/category → safe fallback) so
new server taxonomy never crashes old clients. No third-party dependencies.

## Open & run

1. Install [XcodeGen](https://github.com/yonaskolb/XcodeGen) if you don't have
   it: `brew install xcodegen`.
2. Generate the project (the `.xcodeproj` is gitignored — it's a build
   artifact):
   ```
   cd ios
   xcodegen generate
   ```
3. Open `AIx.xcodeproj` in Xcode, pick an iOS 17+ simulator, and Run (⌘R).

## Tests

```
cd ios
xcodegen generate
xcodebuild -project AIx.xcodeproj -scheme AIx \
  -destination 'platform=iOS Simulator,name=iPhone 17' test
```

All tests are offline: networking is stubbed with a `URLProtocol` mock and
notifications with a fake scheduler.

## Point at localhost vs prod

The base URL defaults to `https://aix.trevormil.com`. Two ways to override:

- **In-app**: Settings tab → *Base URL override* → enter
  `http://localhost:3000` → Save. (App Transport Security already allows local
  networking, so plain-HTTP localhost works.)
- **Xcode scheme env var**: Edit Scheme → Run → Arguments → Environment
  Variables → add `AIX_BASE_URL = http://localhost:3000`. The Settings
  override, if set, wins over the env var.

To run the web backend locally, from the repo root: `bun run dev` in `apps/web`
(serves on `:3000`).

## App Store

The project is submission-ready: single-size app icon, privacy manifest
(`PrivacyInfo.xcprivacy`, no tracking / no data collected), store-configured
Info.plist (developer-tools category, encryption-exempt), and an archive
scheme. The human path from here (team id, App Store Connect record, archive,
TestFlight, review) is documented in
[`docs/runbooks/ios-app-store-submission.md`](../docs/runbooks/ios-app-store-submission.md).
