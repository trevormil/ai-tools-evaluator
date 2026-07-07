---
id: 40
title: "Nightly recap format: newsletter-first briefing; demote feed-social"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ARCH]
depends_on: [0017, 0035, 0039]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Strategic reframe (user): the social-network layer falls on its face on a
cold-start niche site. AIx becomes a NIGHTLY BRIEFING — a harshly-judged
daily recap delivered by email, archived on the web, browsable as a directory.
Feed-social is hidden (not deleted); practitioner-social (takes, "I use this")
stays and feeds the recap.

## Scope
- `items.scoredAt` (migration; set on scored insert + pending→scored upgrade;
  backfill = createdAt) — "when it was judged" is the recap's grouping key.
- `lib/recap.ts`: getRecap(date) → { items, verdictCounts, leadPick,
  complexityTrap, topAdopted }, latestRecapDate, recentRecapDates.
- Web: /recap (latest), /recap/[date], archive index — editorial, dated
  permalinks, SEO-friendly.
- Email: verdict-led template (subject carries counts, lead pick, trap
  callout, top-adopted, link to web recap). Send CronJob points at getRecap.
- Home: directory stays the front door, with a "Tonight's verdicts" recap
  hero + subscribe on top. Nav/mobile: add Recap, drop Activity/feed-social
  from the surface (routes remain dormant). Keep Directory/Leaderboard/Submit/
  Random + takes + I-use-this.

## Acceptance
- /recap/<date> renders the day's verdicts editorially; /recap = latest.
- Subscribe→confirm→send emails the recap; unsubscribe still works.
- Nav no longer surfaces the timeline/DMs/follows; takes + I-use-this intact.
- Unit + e2e green.
