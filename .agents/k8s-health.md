# k8s-health agent (in-repo contract)

An **autonomous self-healing** health check for the *live* AIx Kubernetes
workloads (namespace `aix` on the gauntlet DOKS `sfo2` cluster). Unlike the
[`health`](./health.md) agent — which is a read-only repo/CI snapshot — this one
inspects the running cluster and, when authorized, **fixes it**.

Runs **once an hour** via a TerMinal schedule.

## Model discipline (the whole point)

- **A really cheap OpenRouter model decides.** The script gathers a kubectl
  snapshot and hands it to `or-exec` (default `google/gemini-2.5-flash-lite`,
  ~$0.10/1M in). The cheap model returns a strict-JSON verdict: is anything
  actually wrong, and is it `auto_fix` (an operator/kubectl can fix) or `hitl`
  (only a human can)?
- **Opus only fixes.** No expensive tokens are spent while healthy. Only on
  `auto_fix` does the script escalate to `claude --model opus`.

## Mode

`self-heal` — mutates live infra (and may commit to the repo). Runs `inPlace`
(no worktree) so a hotfix can reach the real checkout / `main`.

## FORCE authorization

This agent is **FORCE-enabled** (owner-granted). The Opus escalation runs with
`TERMINAL_FORCE_MAIN=1` and `--permission-mode bypassPermissions`, so it may:

- `kubectl apply -k k8s/`, `rollout restart`, delete stuck pods, scale, bump limits
- rebuild + push images
- commit and **push a hotfix straight to `main`** to keep prod alive
  (the `block-main-merge.sh` hook honors the `TERMINAL_FORCE_MAIN=1` exception)

The instruction to Opus still prefers the **smallest** fix and a feature-branch
PR when there is no active outage; a direct-main hotfix is reserved for a live
outage.

## Determinism guard

A cheap model can flake. The script computes a deterministic **hard-outage
floor** and will escalate regardless of what the model says when any of these
hold:

- a Deployment has `availableReplicas < replicas`
- a pod is in `CrashLoopBackOff` / `ImagePullBackOff` / `ErrImagePill` right now
- the public endpoint (`https://aix.trevormil.com`) does not return 2xx/3xx

Stale `Completed`/`Error` CronJob pods and benign
`FailedToRetrieveImagePullSecret` warnings are explicitly treated as noise.

## Process

1. **Gather** (no LLM tokens): `kubectl -n aix get pods/deploy/cronjob -o …`,
   recent Warning events, and a `curl` of the public endpoint.
2. **Triage** via the cheap model → `{status, action, fix_kind, fix_plan,
   hitl_reason}`. Fall back to the deterministic floor if `or-exec` is
   unavailable or returns non-JSON.
3. **Route**:
   - `none` → emit an Activity event, exit 0.
   - `auto_fix` → Opus FORCE run applies the fix, then the script **re-probes**
     (endpoint + deployment availability) as a safety net; if still broken it
     files a HITL.
   - `hitl` → file a HITL item **and** a `stuck` backlog ticket (owner
     `k8s-health`) for the human.
4. **Activity** at every branch so the run shows live in TerMinal.

## Config (env, all optional)

| Env | Default | Purpose |
| --- | --- | --- |
| `AIX_NAMESPACE` | `aix` | namespace to inspect |
| `AIX_KUBE_CONTEXT` | `do-sfo2-k8s-…` | kube context (auto-falls back to current if absent) |
| `AIX_HEALTH_URL` | `https://aix.trevormil.com` | endpoint probe |
| `OPENROUTER_API_KEY` | — | required for cheap triage; without it the deterministic floor drives routing |
| `K8S_HEALTH_DRY_RUN` | `0` | `1` → gather + triage + print verdict, never escalate (use for testing) |

## Hard rules

1. **Cheap decides, Opus fixes.** Never burn Opus tokens while healthy.
2. **Determinism floor wins.** A real outage always escalates even if the cheap
   model says healthy.
3. **Verify before declaring done.** An `auto_fix` re-checks endpoint +
   deployment availability; unresolved → HITL.
4. **HITL is for human-only blockers** (secret values, DNS, quota, destructive
   data) — not for anything kubectl can fix.
5. **Smallest fix, surgical scope.** Direct-`main` push reserved for live outages.
