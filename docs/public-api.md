# Public API v1

Read-only, **unauthenticated** JSON over the published corpus. CORS is open
(`access-control-allow-origin: *`) and responses are edge-cacheable. Everything
here is already visible on the public site — the API is just machine access to
it. Base URL: `https://aix.trevormil.com`.

Authoring/write paths live behind a bearer token — see
[`internal-api.md`](./internal-api.md).

## `GET /api/v1/items`

Ranked, filtered list (a page, not the whole corpus). Query params: `sort`
(`hot` | `new` | `top`), `category`, `integration`, `verdict`, `audience`,
`minScore`, `q`, `limit` (≤100). Returns the light item shape (no README, no
full evaluation). Pending community submissions are omitted.

## `GET /api/v1/items/{slug}`

The full canonical evaluation for one item. `404` if missing/unpublished/pending.

## `GET /api/v1/dump`

Bulk dump of the **entire** published corpus — every scored item with its
official evaluation ("take"), README, and metadata. Built for mirroring/export.
Cursor-paginated: follow `nextCursor` until it is `null`.

Query params:

| Param | Default | Notes |
| --- | --- | --- |
| `limit` | `50` | Page size, clamped to `1..100`. Non-numeric → default. |
| `cursor` | — | Opaque token from a prior response's `nextCursor`. Malformed → `400`. |
| `kind` | — | Optional filter: `github_repo` \| `arxiv_paper` \| `external_link`. |

Ordering is newest-first (`createdAt` desc, `id` tiebreak) and stable, so paging
never skips or repeats a row even as new items land. Unpublished and `pending`
items (no real evaluation yet) are excluded.

Response:

```jsonc
{
  "items": [
    {
      "slug": "ripgrep",
      "title": "ripgrep",
      "url": "https://github.com/BurntSushi/ripgrep",
      "kind": "github_repo",
      "externalId": "BurntSushi/ripgrep",
      "category": "cli-tool",
      "integration": "standalone-app",
      "verdict": "essential",
      "overallScore": 92,
      "noiseScore": 5,
      "tagline": "The fastest grep, gitignore-aware by default.",
      "tags": ["search", "rust"],
      "media": [],
      "audience": "both",
      "aiEngineerFit": 80,
      "vibeCoderFit": 70,
      "evaluatedBy": "ai",
      "model": "claude-…",
      "coverImageUrl": null,
      "scoredAt": "2026-07-01T00:00:00.000Z",
      "dailyPickAt": null,
      "upvotes": 3,
      "commentCount": 1,
      "createdAt": "2026-07-01T00:00:00.000Z",
      "readmeMd": "# ripgrep\n…",     // the repo's own README (null if never fetched)
      "evaluation": { /* full @aix/core Evaluation: verdict, body, scores, … */ }
    }
  ],
  "count": 1,                          // items in THIS page
  "nextCursor": "MTkwMDAwMDAwMDpju…"   // null when the corpus is exhausted
}
```

Walk the whole corpus:

```sh
cursor=""
while :; do
  page=$(curl -s "https://aix.trevormil.com/api/v1/dump?limit=100${cursor:+&cursor=$cursor}")
  echo "$page" | jq -c '.items[]'
  cursor=$(echo "$page" | jq -r '.nextCursor // empty')
  [ -z "$cursor" ] && break
done
```

## `GET /api/v1/recap` · `GET /api/v1/recap/{date}` · `GET /api/v1/recap/archive`

The nightly recap: latest, by UTC date (`YYYY-MM-DD`, 404 when nothing was
judged), and the archive of dates. A recap carries `items` (+ per-item `uses`),
`leadPick`, `complexityTrap`, `topAdopted`, `verdictCounts`, and a `summary`
line.

## `GET /api/v1/daily-pick`

The current daily pick — the most recent published item stamped by the
daily-pick job. `{ item: PublicItem & { upvotes, commentCount }, pickedAt }`;
404 until the first pick lands.

Note: `GET /api/v1/items/{slug}` also returns `readmeMd` (the repo's own
README markdown, or null) alongside `evaluation`, and the anonymous
`GET /api/feed` endpoint serves the home timeline (`?mode=all&cursor&limit`)
for read-only clients like the iOS app.
