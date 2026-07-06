# AIx — iOS app

A native SwiftUI client (iOS 17+) for the [AIx](https://aix.trevormil.com)
directory of trending dev tools and papers — each with a harsh verdict and a
ten-metric scorecard. It consumes the public read-only JSON API at
`/api/v1/items` and `/api/v1/items/<slug>`.

## Features

- **Directory** — searchable, filterable list (category / verdict / audience,
  sort by hot / new / top). Each row shows title, tagline, a color-coded
  verdict badge, overall score, and category. Pull-to-refresh, async loading,
  empty and error states.
- **Item detail** — cover image (`AsyncImage`), verdict + overall + noise
  score, tagline, the five body sections (What it is / vs. Vanilla /
  Skill·Plugin·Workflow / Devil's Advocate / Steelman), the 10-metric scorecard
  (bars + rationale), audience-fit meters (AI-engineer vs vibe-coder), tags,
  and a "View source" link.
- **Leaderboard** — top items by score (`sort=top`), plus a "Complexity Trap"
  section (`verdict=complexity-trap`).
- **Settings** — override the backend base URL at runtime (persisted).

## Architecture

```
AIx/
  App/            AIxApp entry + RootView (TabView) + Config (base URL)
  Models/         Codable structs + enums, mirrored 1:1 from packages/core
  Networking/     APIClient (async/await URLSession, typed APIError)
  Design/         Theme (verdict & score colors, light/dark friendly)
  Components/     VerdictBadge, ScoreChip, MetricBar, ItemRow, state views
  Features/
    Directory/    DirectoryView + DirectoryViewModel (@Observable)
    Detail/       ItemDetailView + DetailViewModel
    Leaderboard/  LeaderboardView + LeaderboardViewModel
    Settings/     SettingsView
```

The `Codable` models match the API's JS field names exactly (camelCase:
`overallScore`, `coverImageUrl`, `aiEngineerFit`, the 10 metric keys, etc.), so
a field-name drift on the server is the thing to check first if screens go
empty. No third-party dependencies.

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

## Verification

Built headlessly for the simulator with:

```
cd ios
xcodegen generate
xcodebuild -project AIx.xcodeproj -scheme AIx \
  -destination 'generic/platform=iOS Simulator' -configuration Debug build
```

Result: **BUILD SUCCEEDED** (Xcode 26.6, iOS 17 deployment target). Code
signing is disabled for the simulator build (`CODE_SIGNING_ALLOWED=NO`).
