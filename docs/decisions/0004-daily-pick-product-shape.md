---
anchor: ADR-0004
status: accepted
date: 2026-07-25
---

# ADR-0004: The daily pick ranks product-shape, not popularity

## Status

Accepted. Implemented in `packages/core/src/pick.ts` (ticket 0078).

## [1] Context

The featured daily pick has always used a criteria separate from the site's
`overallScore` — `pickScore` in `packages/core/src/pick.ts` — on the reasoning
that `overallScore` rewards `novelty` and `deltaVsBaseline`, which float
clever-but-niche repos. That separation was right. The signals chosen for it
were not.

Measured over the first 18 picks (prod dump, 2026-07-07 → 07-24):

- **10 of 18 were RAG/vector/search infrastructure** — lightrag, qdrant,
  meilisearch, open-webui, dify, anything-llm, mempalace, langflow, pageindex,
  llm-app.
- The 07-24 pick was `liguodongiot/llm-action`, a Chinese-language README link
  list with `integration: knowledge` — not runnable software at all.
- `block/buzz` (Slack-for-agents, an actual product) was graded on 07-23 and
  **lost**: pickScore 72 against graphify's 90.

The original weights were `aiEngineerFit .40 / utility .25 / traction .15 /
easeOfAdoption .12 / composability .08`. The intent was "broad appeal." What
that set of signals actually describes is **a mature infrastructure primitive**:

1. **Every input maxes out for an ingredient.** Qdrant is useful, widely
   adopted, `docker run`-able, and composable → 93. Buzz is a real product but a
   heavier self-hosted lift → `easeOfAdoption` 40, `traction` 50 → 72. Nothing
   in the evaluation schema distinguished a *product* from a *building block*,
   so the criteria could only rank on proxies that favor building blocks.

2. **`traction` was a fame tax, double-counted.** Discovery already ranks the
   candidate pool by star velocity (`apps/scanner/src/rank.ts`); weighting
   traction again inside the pick re-rewarded popularity a second time. And the
   most famous repos in this space *are* vector databases.

3. **`aiEngineerFit` held 40% of the weight and barely discriminated.** Among
   pick-eligible items it clusters 85–95 (sd 13.4). Weighted-sd per component —
   the component's actual ranking power — was `aiEngineerFit` 5.38, `traction`
   4.07, `utility` 2.01, `easeOfAdoption` 1.98, `composability` 1.53. Traction
   had nearly the ranking power of a term weighted 2.7× larger. **In practice,
   traction picked the winner.**

## [2] Decision

### [2.1] Add `productShape` as a pick-only evaluator signal

A new top-level `productShape: MetricScore` on the Evaluation — deliberately
**not** one of the ten metrics, so it never moves `overallScore`. It asks one
question: *is this a finished thing someone uses, or an ingredient other
software is built from?* 100–80 is an app/UI/service/CLI a person opens; 60–40 a
server or daemon serving other software; 20–0 an engine, database, library,
framework, link list, or paper.

The prompt explicitly instructs the evaluator to score **shape, not quality,
popularity, or usefulness** — "a hugely popular, genuinely excellent vector
database is a 10 because it is an ingredient." Decoupling it from fame is the
whole point; correlating it with stars would just reintroduce fault 2.

It is **optional on a stored Evaluation** (the 134 items already in prod predate
it) but **required of the evaluator** (`EvaluationDraft`). That asymmetry is
deliberate: a model that silently stops emitting the field fails loudly
per-item rather than quietly reverting the pick to the old behavior.

### [2.2] Reweight, and drop `traction` entirely

```
productShape   0.35     (was absent)
utility        0.22     (was 0.25)
aiEngineerFit  0.20     (was 0.40)
easeOfAdoption 0.13     (was 0.12)
composability  0.10     (was 0.08)
traction       —        (was 0.15, removed)
```

`pickScore` renormalizes over whichever components are present, so a pre-0078
item ranks on the four axes it does have rather than being scored as though its
productShape were zero.

Replayed against the real prod numbers, with the productShape values the prompt
is written to produce:

| item | old | new |
| --- | --- | --- |
| qdrant | 93 | 63 |
| meilisearch | 92 | 64 |
| llm-action (link list) | 84 | 54 |
| lightrag | 82 | 54 |
| graphify | 90 | 81 |
| orca | 81 | 81 |
| **buzz** | **72** | **79** |

### [2.3] `integration: knowledge` can never be featured

A hard bar, applied even to the thin-day fallback. A reading list is not a daily
pick. The verdict gate stays *soft* (a day with nothing `essential`/`worthwhile`
still features its best runnable candidate) because skipping a day would break
the daily cadence the Discord digest depends on.

### [2.4] A category cooldown

Categories featured within `PICK_COOLDOWN_DAYS` (3) take a flat
`PICK_REPEAT_PENALTY` (15) — served by `GET /api/internal/recent-picks`. A
penalty rather than a ban, so a thin day where everything is on cooldown still
yields the best available item instead of nothing.

### [2.5] The bot follows the scanner's stamp

The scanner's choice now depends on state the bot can't see (the cooldown), so
the digest endpoint emits `isDailyPick` and `integration`, and the bot prefers
the stamped item over its own top-`pickScore` reckoning. Otherwise Discord and
the site could headline different items on the same day.

## [3] Consequences

- **Only new evaluations get `productShape`.** The 134 existing items rank via
  renormalization, which is close to the old ordering minus traction. Backfilling
  would mean re-running the evaluator over the whole corpus; not worth it, since
  only same-day batches compete for the feature slot.
- **The prompt is now load-bearing for the pick.** If the evaluator conflates
  shape with quality, the skew comes back in a new form. `AIX_DRY_RUN` prints
  `productShape` and `pickScore` per item so this is checkable without
  publishing. The first live runs should be spot-checked.
- **A day can now have no pick** if every graded item is `knowledge`. The scanner
  logs a warning and publishes runners-up only.
- **`overallScore` is untouched.** The site's rankings, item pages, and existing
  scorecards behave exactly as before; this ADR changes only what gets featured.

## [4] Alternatives considered

- **Heuristic deny-list** (bar `rag`/`dataset`/`model` categories, cap traction,
  no schema change). Would have blocked lightrag and llm-action, but would not
  have *promoted* Buzz — with no product-shape signal, the ranking among what
  survived is unchanged. It filters bad picks rather than finding good ones.
- **Reuse the existing `lens` field** (set `lens: product` at discovery, then
  require it for picks). Reuses machinery already in the schema, but it moves the
  classification burden to discovery, which has only repo metadata to go on —
  and `lens` is currently `null` on every item in prod, so the mechanism is
  untested. `productShape` puts the judgment where the README is already being
  read.
