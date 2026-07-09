# k8s-health agent (in-repo contract)

An **hourly, open-ended, autonomous** health check + self-heal for the *live* AIx
Kubernetes workloads (namespace `aix` on the gauntlet DOKS `sfo2` cluster).

Unlike the read-only [`health`](./health.md) agent (a repo/CI snapshot), this one
inspects the running cluster **and keeps it alive**.

## Design: one free-roaming codex session per run

There are deliberately **no rigid pass/fail rules**. Each hour the script starts a
single `codex exec` session (DEFAULT model, `~/.codex` auth) with:

- an **access map** — context/namespace, the three workloads + the single-writer
  DB invariant, the public site + internal API, the TLS secret, and where the
  manifests live;
- a **checklist** — pods/deployments, cronjob-latest-job health, the public site
  + a DB-backed route, TLS cert validity/expiry, the `aix-db` PVC + migrations,
  logs/events, and resource/OOM headroom;
- an explicit instruction to **go beyond the checklist** — investigate freely,
  verify its own findings, and surface anything else that threatens availability.

The model decides what's wrong and how sure it is — that's the point of using a
session instead of a scripted rule engine.

## FORCE authorization + what it does with findings

FORCE-enabled (owner-granted). `codex exec -s danger-full-access` +
`TERMINAL_FORCE_MAIN=1`, so it may run anything and push a hotfix to `main`.

- **Healthy** → emit one `activity` summary of what it checked, stop.
- **Easy / safe fix** (rollout restart, delete a stuck pod, `kubectl apply -k
  k8s/`, clear a wedged job, bump a limit) → **do it live and re-verify**. If the
  fix is a manifest change, also open a PR so the repo matches reality.
- **Needs a human** (risky/ambiguous, a real code or manifest bug, a missing/
  expired secret value, DNS, cloud quota, a destructive data decision) → **file a
  backlog ticket + open a merge-ready PR + notify** (`hitl` and `terminal-cli
  notify`). It does not force these.

## Guardrails (in the prompt, not the harness)

- Never scale `aix-web` past 1 replica (single-writer SQLite).
- Never delete PVCs or data.
- Prefer the smallest fix; always verify after fixing; one summary notification,
  no spam.

## Config (env, all optional)

| Env | Default | Purpose |
| --- | --- | --- |
| `AIX_NAMESPACE` | `aix` | namespace to inspect |
| `AIX_KUBE_CONTEXT` | `do-sfo2-k8s-…` | kube context (auto-falls back to current if absent) |
| `AIX_HEALTH_URL` | `https://aix.trevormil.com` | public site to probe |

The script prepends `.claude/bin`, `~/.config/TerMinal/bin`, and `~/.bun/bin` to
`PATH` so codex can call `activity` / `hitl` / `terminal-cli` / `gh` directly.

## Schedule

Hourly (`everyMinutes: 60`) in `~/.config/TerMinal/schedules.json`.

## Notes

- Runs in a TerMinal-provided worktree (`inPlace: false`); PRs branch off freshly
  fetched `origin/main` so they don't entangle with in-flight work.
- Uses codex's default model / `~/.codex` auth — no OpenRouter key needed (the
  earlier cheap-triage design was replaced by this open-ended session).
