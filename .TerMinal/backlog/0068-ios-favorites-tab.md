---
id: 068
title: "iOS: Favorites tab — bookmark AIx items + save custom links, all on-device"
status: in-progress
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/56"]
refs: []
depends_on: ["060"]
acceptance:
  - "Item detail gains a bookmark toggle; saved items persist locally (UserDefaults JSON) and survive relaunch"
  - "Favorites tab, segment 1: saved AIx items as standard rows navigating to item detail; swipe to remove"
  - "Favorites tab, segment 2: custom saved links (paste any URL — X posts, skills, whatever) with optional title + note; rows open the URL; swipe to remove"
  - "Add-link sheet validates http(s) URLs, offers paste-from-clipboard, dedupes on normalized URL"
  - "FavoritesStore unit tests: toggle/persist round-trip via an injected UserDefaults suite, link validation + dedupe"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Personal, device-local collection — no accounts (the app stays read-only
against the server), so favorites live in UserDefaults as Codable JSON. Two
facets in one tab: AIx items you've bookmarked from their detail page, and a
free-form reading list of pasted URLs. A share-sheet extension (save from
other apps) would be a nice follow-up but is out of scope here — pasting is
the v1 mechanism.
