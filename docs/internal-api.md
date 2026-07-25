# AIx internal API contract (v1)

The scanner and Discord bot never open SQLite directly (single-writer rule).
They call these `web` endpoints. All internal routes live under `/api/internal/*`
and require header `Authorization: Bearer $AIX_INTERNAL_TOKEN`; missing/wrong
token → `401`. Bodies are JSON. Types come from `@aix/core` and `@aix/db`.

## Endpoints

### `POST /api/internal/items`
Publish an evaluated item. Body: `{ evaluation: Evaluation, submissionId?: string }`
where `evaluation` validates against `@aix/core`'s `Evaluation` schema. Behavior:
insert into `items` (denormalized cols + `evaluationJson`); if `submissionId`
given, mark that submission `published` and link `itemId`. Idempotent on
(`kind`,`externalId`): a duplicate returns `200 {duplicate:true, item}` instead
of inserting.
Response: `201 { item }` | `200 { duplicate:true, item }`.

### `POST /api/internal/items/known`
Pre-eval dedup. Body `{ candidates: [{ kind, externalId }] }` → `{ known: [externalId] }`
— the subset already in the catalog with a real score. The scanner calls this
before ranking so it never spends an eval on (or re-picks) an already-graded item.

### `GET /api/internal/cap`
Daily-cap accounting. Response: `{ date, publishedToday, remaining, dailyCap:10 }`.
Scanner uses `remaining` to bound a run.

### `GET /api/internal/recent-picks?days=N`
Categories featured as the daily pick inside the cooldown window (deduped).
`days` defaults to `PICK_COOLDOWN_DAYS` (3), capped at 30. Response:
`{ days, categories: string[] }`. The scanner penalizes these when choosing
today's pick so the feature slot doesn't repeat a category (ADR-0004). Advisory
— the scanner treats a failure here as "no cooldown" rather than aborting.

### `GET /api/internal/submissions?status=queued&limit=N`
List queued submissions oldest-first (the drain order). Response:
`{ submissions: Submission[] }`.

### `POST /api/internal/submissions`
Enqueue a link (used by the Discord `/submit` command). Body:
`{ url, note?, source:"discord"|"api", discordUserId? }`. Dedups obvious repeats.
Response: `201 { submission }` | `200 { duplicate:true }`.

### `PATCH /api/internal/submissions/:id`
Update a submission's status during processing. Body:
`{ status:"processing"|"published"|"duplicate"|"rejected"|"failed", reason?, itemId? }`.
Response: `200 { submission }`.

### `GET /api/internal/digest?since=<iso>`
Data for the bot's daily digest. Response: `{ items: Array<{slug,title,url,verdict,overallScore,pickScore,tagline,category,integration,isDailyPick,coverImageUrl}> }`
for items published since `since`. `pickScore` is the product-appeal ranking
(`@aix/core`'s `pickScore`, falling back to `overallScore` for items missing the
signals); `isDailyPick` is true for the item the scanner stamped, which the bot
prefers so Discord features the same item as the site (ADR-0004).

### `POST /api/internal/scan-runs` and `PATCH /api/internal/scan-runs/:id`
Open/close a `scan_runs` audit row. Open body `{ source }` → `{ id }`. Close body
`{ status, discovered, published, skippedDuplicate, error? }`.

## Notes
- The scanner imports `@aix/core` for the schema + evaluator prompt, builds an
  `Evaluation`, then POSTs it here — it does NOT import `@aix/db`.
- The bot only ever calls `/submissions` (POST) and `/digest` (GET).
- `AIX_INTERNAL_TOKEN`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `DISCORD_TOKEN` are
  injected via k8s Secrets; locally via `.env`.
