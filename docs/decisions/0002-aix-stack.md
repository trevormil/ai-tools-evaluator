---
anchor: ADR-0002
status: accepted
date: 2026-07-06
---

# ADR-0002: AIx stack, storage, and topology

## Status

Accepted.

## Context

AIx is a dual directory + social site that auto-scans GitHub and arXiv daily,
evaluates items with Claude, and hosts Twitter-like discussion. It deploys to
`aix.trevormil.com` on the existing k8s cluster (nginx ingress + cert-manager +
ghcr images). Built in "vibe mode" — fast, decisions auto-made — but shipped for
real. The user chose SQLite.

## Decision

- **Runtime & language:** Bun + TypeScript everywhere (global §5/§6).
- **Web:** Next.js 15 App Router (SSR for SEO-worthy item pages, React + Tailwind
  for the mobile-first social UI, API routes in the same deployable).
- **DB:** SQLite via Drizzle ORM + `bun:sqlite`. Migrations generated with
  drizzle-kit, applied at boot with the bun-sqlite migrator (no node driver dep).
- **Storage topology:** one PVC (`ReadWriteOnce`), mounted only by the `web` pod
  at `replicas: 1`. Scanner + bot reach data through `web`'s authenticated
  internal API — **single writer**, no distributed SQLite.
- **Source of truth = DB; git-native archive = derived.** Every published
  evaluation is also exported as a strict `.md` artifact with an embedded
  canonical JSON block, giving the requested git-native `.md` corpus without
  making files the primary store.
- **AI evaluation:** `@anthropic-ai/sdk`, latest Claude, with a deliberately
  harsh skeptic system prompt. Output validated against a strict zod schema.
- **Auth:** GitHub OAuth (fits a dev-tool audience; gives us avatar + identity
  cheaply). Opaque server sessions in the `sessions` table.
- **Discord:** discord.js bot as its own Deployment.

## Consequences

- `web` cannot horizontally scale on writes (replicas pinned to 1). Acceptable at
  this scale; revisit with Litestream or Postgres if traffic demands it.
- The internal API is a real surface that must be secured (shared secret, not
  public). Documented in `docs/architecture.md#1`.
- Choosing Next.js over a lighter Hono+SPA trades some hand-written simplicity for
  SSR + a batteries-included API/routing story.

## Alternatives considered

- **Git-native `.md` only (no DB):** rejected — a social site (votes, comments,
  feeds, profiles) needs relational queries and concurrent writes. Kept as a
  derived archive instead.
- **Postgres:** heavier than the user asked for; SQLite is enough at this scale.
- **Hono + React SPA:** lighter but loses SSR/SEO for item pages, which matter for
  a discovery product.
