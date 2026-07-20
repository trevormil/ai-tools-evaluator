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

## `GET /api/v1/items/{slug}/social`

The item's social surface: takes (practitioner blurbs with status + ★rating),
the nested comment thread, and use counts. Pending ("Awaiting score…") items
are socially live — only unpublished items 404. With an
`Authorization: Bearer <session token>` header (mobile sessions, ticket 0057),
`viewer` carries your vote, comment votes, and stack entry; anonymous callers
get `viewer: null`.

```json
{
  "social": {
    "takes": [{ "id": "…", "status": "using", "rating": 5, "take": "…",
                "user": { "username": "…", "displayName": "…", "avatarUrl": null } }],
    "comments": [{ "id": "…", "body": "…", "author": { "username": "…" }, "children": [] }],
    "useCount": 2, "byStatus": { "using": 1, "trying": 1 },
    "upvotes": 5, "commentCount": 2
  },
  "viewer": { "vote": 1, "commentVotes": {}, "stack": { "status": "trying" } }
}
```

## `GET /api/v1/users/{username}`

Profile JSON mirroring `/u/{username}`: public user, profile links, follow
counts, takes, stack, recent activity, and the tools they brought in
(`broughtIn`). Bearer viewers get `viewer: { following, self }`.

## `GET /api/v1/leaderboard`

The three ranked lists as `PublicItem & { upvotes, commentCount }` arrays:
`topRated` (overall score), `mostDiscussed` (comment count), `hallOfShame`
(complexity-trap / redundant verdicts by noise).

## `GET /api/v1/recap` · `GET /api/v1/recap/{date}` · `GET /api/v1/recap/archive`

The nightly recap: latest, by UTC date (`YYYY-MM-DD`, 404 when nothing was
judged), and the archive of dates. A recap carries `items` (+ per-item `uses`),
`leadPick`, `complexityTrap`, `topAdopted`, `verdictCounts`, and a `summary`
line.

## Authenticated use from native clients

Every session-authed web endpoint (`/api/comments`, `/api/votes`,
`/api/follows`, `/api/stack`, `/api/reposts`, `/api/messages*`,
`/api/notifications`, `/api/profile`, `/api/rescore`, `/api/submissions`,
`/api/feed`) also accepts `Authorization: Bearer <session token>`. Native
clients obtain the token via `GET /api/auth/github?client=ios` — the OAuth
callback hands it back on the `aix://auth#token=…` custom scheme.
