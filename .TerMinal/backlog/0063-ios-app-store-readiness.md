---
id: 063
title: "iOS: App Store submission readiness (icon, privacy manifest, signing, metadata, runbook)"
status: in-progress
priority: high
horizon: now
hitl: true
type: chore
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: ["060", "062", "065"]
acceptance:
  - "App icon (1024pt single-size) + accent color in the asset catalog; launch screen configured"
  - "PrivacyInfo.xcprivacy privacy manifest present and accurate (UserDefaults reason code, no tracking)"
  - "Info.plist store-ready: display name, category, encryption-exempt declaration (ITSAppUsesNonExemptEncryption=false), portrait-primary; ATS with no arbitrary-loads"
  - "project.yml signing-ready: DEVELOPMENT_TEAM placeholder documented, CODE_SIGNING_ALLOWED restored for device builds, archive scheme present"
  - "docs/runbooks/ios-app-store-submission.md: full path from xcodegen to TestFlight to review (App Store Connect listing fields, privacy nutrition answers, screenshot matrix, review notes incl. demo account guidance)"
  - "Release build (xcodebuild -configuration Release, generic/platform=iOS Simulator) succeeds with zero warnings-as-errors"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Everything needed so the only human steps are: paste the real
`DEVELOPMENT_TEAM`, create the App Store Connect record, upload, submit.
HITL by nature: Apple Developer account credentials, the actual archive
upload, and App Review submission are human-only. Review posture is simple:
the app is a read-only content browser (no accounts, no UGC creation, no
tracking) — the feed *displays* website community content, which the runbook
should note alongside the site's moderation story (/admin) in case review
asks. Privacy nutrition label: no data collected.
