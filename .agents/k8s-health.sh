#!/usr/bin/env bash
# k8s-health — hourly autonomous health check + self-heal for the live AIx app.
#
# One open-ended codex session per run. No rigid rules: codex gets an access map
# and a checklist, but is told to investigate freely, verify its own findings,
# and surface anything else that threatens health. FORCE-enabled — it may fix
# live infra directly (kubectl apply/rollout, etc.) and, when only a human should
# decide, it files a ticket + opens a PR + pings the human.
#
# Engine: codex exec, DEFAULT model (uses ~/.codex auth). Runs even when TerMinal
# is closed (launchd). Env from TerMinal: TERMINAL_REPO / TERMINAL_WORKTREE.
set -uo pipefail

repo="${TERMINAL_REPO:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
worktree="${TERMINAL_WORKTREE:-$repo}"
ns="${AIX_NAMESPACE:-aix}"
ctx="${AIX_KUBE_CONTEXT:-do-sfo2-k8s-1-35-1-do-3-sfo2-1777411058629}"
url="${AIX_HEALTH_URL:-https://aix.trevormil.com}"

# Make the repo + TerMinal helpers and common bins reachable for codex's shells.
export PATH="$repo/.claude/bin:$HOME/.config/TerMinal/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v codex >/dev/null || { echo "k8s-health: codex not on PATH" >&2; exit 2; }

# Only pin the kube context if it exists here; else codex uses the current one.
kctx_hint="$ctx"
if ! kubectl config get-contexts -o name 2>/dev/null | grep -qxF "$ctx"; then
  kctx_hint="$(kubectl config current-context 2>/dev/null || echo '<current context>')"
fi

"$repo/.claude/bin/activity" check "k8s-health · hourly run" "namespace $ns @ $kctx_hint" >/dev/null 2>&1 || true

prompt="You are the autonomous SRE for the AIx production app running on Kubernetes.
Your job this run: verify the whole system is healthy and KEEP IT ALIVE. You have
FULL authorization — run any command (kubectl, curl, openssl, gh, git, psql/sqlite
via kubectl exec, the repo helpers). Investigate freely and VERIFY your own
findings before acting; don't trust a single signal.

== ACCESS MAP ==
- Cluster/context: '$kctx_hint'  •  namespace: '$ns'  (use: kubectl --context '$kctx_hint' -n '$ns' ...)
- Workloads:
  * aix-web    Deployment (replicas: 1) — Next.js on :3000. OWNS the SQLite DB on
               PVC 'aix-db' (RWO) and runs migrations at boot. SINGLE-WRITER: only
               aix-web may mount aix-db / touch the DB. NEVER scale it past 1.
  * aix-bot    Deployment (replicas: 1) — long-running Discord bot.
  * aix-scanner / aix-rank / aix-queue  CronJobs — call web's internal API; never
               open the DB directly (they use http://aix-web.$ns.svc.cluster.local
               with AIX_INTERNAL_TOKEN from the 'aix-secrets' secret).
- Public site: $url  (nginx ingress + cert-manager 'letsencrypt-prod', TLS secret
  'aix-trevormil-tls'). Public API examples: $url/  and  $url/api/v1/items (a DB read).
- Repo (this checkout): '$worktree'. Manifests live in k8s/; deploy with
  'kubectl apply -k k8s/'. Images: ghcr.io/trevormil/aix-{web,scanner,bot}.

== CHECKLIST (do all, then go beyond it) ==
1. Pods/Deployments: everything Running/Ready, replicas Available, no
   CrashLoopBackOff / ImagePull errors / Pending. Look for restart storms and
   OOMKilled (check restart counts AND recent container terminations, not just
   'is it Running now').
2. CronJobs: the LATEST job of scanner/rank/queue actually succeeded; none are
   wedged or failing every run; schedules look sane.
3. Public site: $url returns 200 and renders; a DB-backed route ($url/api/v1/items)
   works. Also check the internal API health if useful.
4. TLS cert: 'aix-trevormil-tls' is valid and NOT expiring soon (e.g. openssl
   s_client / curl -vI). cert-manager renewing cleanly.
5. Database/PVC: 'aix-db' PVC Bound and not near-full; migrations applied; single-
   writer invariant intact (only aix-web mounts it). Spot-check the DB is readable.
6. Logs & events: scan aix-web / aix-bot logs and recent Warning events for
   repeated errors, exceptions, OOM, or restart loops.
7. Resources: memory/CPU limits vs. actual usage — anything trending toward OOM.
8. OPEN-ENDED: proactively find anything else that threatens availability or that
   we should be handling but aren't (misconfig, missing probes, drift between the
   live cluster and k8s/*.yaml, expiring things, etc.).

== WHAT TO DO WITH WHAT YOU FIND ==
- Nothing wrong: emit one activity event summarizing what you checked and stop.
    activity check \"k8s-health · healthy\" \"<one-line summary>\"
- EASY / SAFE fix (rollout restart, delete a stuck pod, re-apply 'kubectl apply -k
  k8s/', clear a wedged job, bump a resource limit): JUST DO IT LIVE, then VERIFY
  it worked (re-check pods + endpoint). Keep it surgical. If the fix is a manifest
  change in k8s/, also commit it on a branch off freshly-fetched origin/main and
  open a PR so the repo matches reality (see below).
- NEEDS A HUMAN (risky, ambiguous, a real code/manifest bug, missing/expired
  secret VALUE, DNS, cloud quota, a destructive data decision): do NOT force it.
  Instead:
    1) file a ticket:   terminal-cli ticket \"k8s-health: <title>\" \"<what/why/proposed fix>\"
    2) open a PR with the proposed fix if code/manifests are involved: branch off
       'git fetch origin main' + 'origin/main', commit surgically, push, 'gh pr
       create --base main' (this is a GitHub repo). Make it merge-ready.
    3) notify the human:
         hitl \"AIx k8s: <title>\" \"<action needed>\" \"<detail + links>\"
         terminal-cli notify \"AIx k8s-health: <short status + what you did/need>\"

Rules: never scale aix-web past 1 replica; never delete PVCs or data; prefer the
smallest fix; always verify after fixing; don't spam notifications (one summary).
Report at the end: what you checked, what you found, what you fixed, and any
ticket/PR/HITL you filed."

# FORCE: allow direct-to-main hotfixes if codex decides a live outage needs one.
export TERMINAL_FORCE_MAIN=1

codex exec -s danger-full-access -C "$worktree" "$prompt"
