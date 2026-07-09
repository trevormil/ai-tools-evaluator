---
id: 0047
title: "public API: paginated /api/v1/dump of the full corpus"
status: closed
priority: medium
type: feature
source: request
created: 2026-07-09
updated: 2026-07-09
agent_id: web
agent_scope: repo
agent_kind: classic
prs: []
---

Expose a public, read-only, cursor-paginated endpoint that dumps every
published+scored item with its official evaluation ("take"), README, and
metadata — for mirroring/export of the whole corpus in one walk.

## Design

- Route `GET /api/v1/dump` (public, CORS `*`, edge-cacheable) — matches the
  existing `/api/v1/*` surface; all data is already individually public.
- Cursor pagination on `(createdAt desc, id desc)` — stable, no skip/repeat as
  new items land. `?limit=` (≤100), `?cursor=` (opaque), `?kind=` filter.
- Excludes unpublished and `pending` items (no real evaluation yet).
- New `dumpItems()` query + `toDumpItem()` whitelisted projection (never a raw
  DB row); README + full `@aix/core` Evaluation included.

## Verification

- `apps/web/app/api/v1/dump/route.test.ts` — pagination integrity (walks all
  pages, no dupes), exclusion of unpublished/pending, kind filter, evaluation +
  README payload, malformed-cursor 400, CORS/OPTIONS.
- Driven against the real local corpus: 10 items across 4 pages, 9 repos + 1
  paper, `kind=github_repo` → 9. Docs: `docs/public-api.md`.
