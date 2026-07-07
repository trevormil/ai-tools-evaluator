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

### `GET /api/internal/cap`
Daily-cap accounting. Response: `{ date, publishedToday, remaining, dailyCap:10 }`.
Scanner uses `remaining` to bound a run.

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
Data for the bot's daily digest. Response: `{ items: Array<{slug,title,url,verdict,overallScore,tagline,category,coverImageUrl}> }`
for items published since `since`.

### `POST /api/internal/scan-runs` and `PATCH /api/internal/scan-runs/:id`
Open/close a `scan_runs` audit row. Open body `{ source }` → `{ id }`. Close body
`{ status, discovered, published, skippedDuplicate, error? }`.

### `POST /api/internal/newsletter/send`
Send the daily digest to all `active` subscribers. Body `{ since?: iso }` (defaults
to the last 24h). Renders items published since `since`, emails each active
subscriber (per-subscriber, so each carries its own unsubscribe token), no-op when
there are no new items. Called by the `aix-newsletter` CronJob. Response:
`{ sent, subscribers, items }`.

## Public newsletter routes (not internal)
- `POST /api/newsletter/subscribe` `{ email }` — double opt-in; creates a `pending`
  subscriber + emails a confirm link. Never reveals prior subscription state.
- `GET /newsletter/confirm?token=` — activates the subscription.
- `GET /newsletter/unsubscribe?token=` — one-click unsubscribe.
Sending uses Resend (`RESEND_API_KEY`); with no key it logs only. Links use
`AIX_PUBLIC_URL`.

## Notes
- The scanner imports `@aix/core` for the schema + evaluator prompt, builds an
  `Evaluation`, then POSTs it here — it does NOT import `@aix/db`.
- The bot only ever calls `/submissions` (POST) and `/digest` (GET).
- `AIX_INTERNAL_TOKEN`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `DISCORD_TOKEN` are
  injected via k8s Secrets; locally via `.env`.
