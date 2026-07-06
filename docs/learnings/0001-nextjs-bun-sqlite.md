---
title: Next.js + bun:sqlite needs the --bun runtime, and guard against yarn PnP
date: 2026-07-06
tags: [nextjs, bun, sqlite, build, gotcha]
---

# Next.js + `bun:sqlite`: two traps

The web app uses `bun:sqlite` (via `@aix/db`). Two non-obvious things make or break the build.

## [1] `next build`/`next start` must run under the bun runtime

`bun:sqlite` is a bun built-in; Node cannot resolve it. But the `next` bin has a
`#!/usr/bin/env node` shebang, so a plain `next build` runs under **Node**, and
its page-data-collection workers (jest-worker child processes) inherit Node —
which then throws `Cannot find module 'bun:sqlite'` when it imports any route
that transitively pulls in the DB client.

**Fix:** force the bun runtime with `--bun`. The web `package.json` scripts are
written as `bun --bun next build` / `bun --bun next start` so that `bun run build`
(and the Dockerfile) always spawn Next under bun. Then `process.execPath` is bun,
the workers are bun, and `bun:sqlite` resolves at both build and runtime.

Corollary: keep all DB access server-only (route handlers / server components).
`next.config` marks `bun:sqlite` external + `transpilePackages: ["@aix/core","@aix/db"]`.

## [2] Next can auto-trigger a Yarn PnP install that nukes `node_modules`

If `next build` detects a missing type dep (e.g. `@types/node`), it may
auto-run a package-manager install. If it picks Yarn, it writes `.pnp.cjs`,
`.pnp.loader.mjs`, `yarn.lock`, `.yarn/` and **replaces** the bun-managed
`node_modules` — breaking the whole workspace (including any other app mid-build).

**Guards in place:**
- `@types/node` is kept in `apps/web/package.json` so Next has no reason to
  auto-install.
- `.gitignore` excludes `.pnp.*`, `.yarn/`, `yarn.lock`.
- Recovery if it happens again: `rm -f .pnp.* yarn.lock && rm -rf .yarn node_modules && bun install`.

## Note on bun's isolated store

`bun install` here uses an isolated layout: real packages live in
`node_modules/.bun/`, and each workspace's `node_modules` holds symlinks. So a
top-level `ls node_modules` looking sparse is normal — resolve from the workspace
dir (`apps/web`) to verify a dep, not from the repo root.
