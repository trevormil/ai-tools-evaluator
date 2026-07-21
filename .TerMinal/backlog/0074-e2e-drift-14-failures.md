---
id: 074
title: "e2e: 14 specs drifted from the app while the suite was dark (unblocked by 0066)"
status: open
priority: high
horizon: now
hitl: false
type: bug
source: manual
created: 2026-07-21
updated: 2026-07-21
prs: []
refs: ["066"]
depends_on: []
acceptance:
  - "bun run test:e2e is fully green, or every intentionally-removed assertion is deleted with a note saying why"
  - "public.spec.ts home/recap/nav/directory expectations match the current home page"
  - "feed.spec.ts, item-social.spec.ts, profile.spec.ts, submissions.spec.ts pass"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Ticket 0066 fixed the seed so the Playwright suite boots again. First full run:
**21 passed, 14 failed**. The failures are pre-existing drift, not a regression —
verified by re-running `public.spec.ts` with the privacy-page branch's web
changes stashed and getting the identical 5 failures.

The suite was dark long enough for the app to move underneath it. Example:
`public.spec.ts:18` asserts the home page "leads with the nightly recap hero"
and waits for the text `The nightly recap`, which no longer renders on `/` —
home became the unified Browse surface (#59-#61 era). So the tests encode a
home page that no longer exists.

Failing specs:

- `public.spec.ts` — directory filter, recap hero, nav Recap link, `/directory`
  redirect, newsletter subscribe (5)
- `feed.spec.ts` — all 6
- `item-social.spec.ts:12`, `profile.spec.ts:16`, `submissions.spec.ts:10` (3)

Work: for each, decide whether the *test* is stale (update the assertion to the
current surface) or the *app* regressed (fix the app). Do not blanket-update
tests to match current output — that is exactly the green-rigging the TDD gate
forbids. Where a test encoded a product decision that was later reversed, delete
it and say so in the commit.

Worth adding once green: a CI job so the suite can't go dark again — that is the
root cause of 14 tests rotting unnoticed.
