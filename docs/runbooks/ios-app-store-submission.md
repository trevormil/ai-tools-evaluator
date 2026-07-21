# Runbook — AIx iOS App Store submission

The repo side is fully prepared: icon, privacy manifest, store-ready
Info.plist, tests, and an archive scheme. The steps below are the human-only
path from a clean checkout to App Review. Total hands-on time ≈ 30–45 min
(plus Apple processing).

## What's already done in-repo

- **Project**: `ios/project.yml` (XcodeGen). `xcodegen generate` produces
  `AIx.xcodeproj`. Unit tests: `AIxTests` (`xcodebuild test`).
- **Icon**: `AIx/Assets.xcassets/AppIcon.appiconset/icon-1024.png`
  (single-size universal; regenerate with the CoreGraphics script in the PR
  that added it if the brand changes).
- **Privacy manifest**: `AIx/PrivacyInfo.xcprivacy` — no tracking, **no
  collected data**, UserDefaults access reason `CA92.1` (own settings).
- **Info.plist** (via project.yml): `LSApplicationCategoryType` =
  developer-tools, `ITSAppUsesNonExemptEncryption` = false (standard HTTPS
  only → no export-compliance questionnaire), portrait+landscape,
  launch screen = plain system background.
- **App behavior relevant to review**: read-only content browser over
  `https://aix.trevormil.com` public APIs. No accounts, no user-generated
  content creation, no payments, no tracking. One optional **local**
  notification (daily-pick reminder; permission requested only when the user
  flips the toggle in Settings).

## 0. Prerequisites (once)

- Apple Developer Program membership ($99/yr) on the account that will own
  the app.
- Xcode signed in to that account (Settings → Accounts).

## 1. Set the team + verify the build

```sh
cd ios
# Put your Team ID in project.yml → settings.base.DEVELOPMENT_TEAM
xcodegen generate
xcodebuild -project AIx.xcodeproj -scheme AIx \
  -destination 'platform=iOS Simulator,name=iPhone 17' test   # must be green
```

Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in `project.yml` for
each store upload (build number must strictly increase). `Info.plist` reads
both through `$(...)` variables, so `project.yml` is the only place to edit —
or pass `--bump` to the script in §3.

## 2. App Store Connect record (once)

appstoreconnect.apple.com → My Apps → **+ New App**:

- Platform iOS · Name **AIx** (fallbacks if taken: "AIx — AI Tool Verdicts")
- Primary language English (U.S.) · Bundle ID `com.trevormil.aix`
  (register it under Certificates → Identifiers if not offered)
- SKU: `aix-ios` · Full access.

## 3. Archive + upload

```sh
cd ios
cp .testflight.env.example .testflight.env   # once: fill in ASC_KEY_ID + ASC_ISSUER_ID
./scripts/testflight.sh --bump               # tests → archive → upload
```

`scripts/testflight.sh` runs the tests, archives Release, generates
`ExportOptions.plist` (team id read from `project.yml`), and uploads straight
to TestFlight. `--bump` increments the build number first; `--dry-run` stops
after export.

Credentials come from an App Store Connect API key (Users and Access →
Integrations → App Store Connect API, role **App Manager**). The `.p8`
downloads exactly once — keep it at
`~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`, never in the repo.
`.testflight.env` is gitignored.

Xcode GUI alternative: open `AIx.xcodeproj`, scheme **AIx**, destination
**Any iOS Device (arm64)** → Product → **Archive** → Organizer →
**Distribute App** → App Store Connect → Upload.

## 4. TestFlight sanity pass (recommended, ~10 min)

Processing takes ~15–60 min. Install via TestFlight on a real device and
check: feed loads (pick card + recap strip once judged content exists) ·
item detail tabs render (incl. a README-bearing item) ·
recap opens from the strip · daily-pick reminder toggle asks permission and a
test notification deep-links to the pick (set device clock past 9am or
temporarily lower `DailyPickReminder.fireHour`).

## 5. Store listing

- **Subtitle** (30 chars): `Honest AI tool verdicts`
- **Description** (draft):

  > AIx judges the daily flood of AI tools, MCP servers, libraries, and
  > research papers — harshly and honestly. Every item gets a 10-metric
  > scorecard, a forced verdict from "essential" to "complexity trap", and a
  > devil's-advocate answer to one question: is this actually worth it, or
  > just complexity?
  >
  > • Daily pick — the one tool judged most worth your attention
  > • The feed — everything judged, as it lands
  > • Directory — search and filter by category, verdict, and audience
  > • Scorecards — novelty, utility, delta vs a vanilla agent, and 7 more
  > • Nightly recap — what was judged, what won, what got called out

- **Keywords** (100 chars): `ai,tools,mcp,agent,llm,claude,developer,evaluations,reviews,papers,trending`
- **Category**: Developer Tools (secondary: News)
- **Age rating**: everything "None" → 4+ (content is developer-tool reviews;
  the questionnaire's "unrestricted web access" answer is **No** — the app
  only renders our own API content).
- **Privacy nutrition label**: Data Not Collected (matches the manifest —
  the app makes anonymous GETs only).
- **Screenshots**: required sizes 6.9" (iPhone 17 Pro Max sim) and 6.5".
  Take: Feed with Today's pick · Item detail Evaluation tab · Scorecard ·
  Recap. `xcrun simctl io booted screenshot feed.png` etc.
- **Support URL**: https://aix.trevormil.com · **Marketing URL**: same.

## 6. Review notes (paste into App Review Information)

> AIx is a read-only companion to aix.trevormil.com, a directory of
> AI-generated evaluations of developer tools. No account is needed or
> offered in the app. The feed displays community activity from the website
> (read-only in the app); community content is moderated on the website by
> the site operators. The only notification is a local daily reminder the
> user opts into from Settings.

No demo account required (nothing to sign in to).

## 7. Submit + after approval

Add the build to the version → **Submit for Review** (typical turnaround
24–48h). Common first-submission rejections to pre-empt: 2.1 crashes on
launch when the API is unreachable (we render a retry state — verify once in
airplane mode) and 4.2 minimum functionality (the scorecards/verdicts are
substantive native content beyond a web wrapper — say so in review notes if
challenged).

After approval: releases are manual by default; pick automatic if preferred.
File follow-ups for anything review forces (e.g. copy changes) as tickets.
