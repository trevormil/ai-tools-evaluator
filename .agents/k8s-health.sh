#!/usr/bin/env bash
# k8s-health — autonomous self-healing health check for the live AIx workloads.
#
# Gathers a live kubectl snapshot of the `aix` namespace, asks a REALLY cheap
# OpenRouter model (via or-exec) to triage whether anything is actually wrong and
# whether it is auto-fixable, then:
#   • healthy   → emit an activity event, exit 0 (no expensive tokens spent).
#   • auto_fix  → escalate to Opus as a FORCE autonomous SRE that may
#                 `kubectl apply`/rollout/delete, rebuild+push images, and even
#                 commit+push to main (TERMINAL_FORCE_MAIN=1) to keep prod alive.
#   • hitl      → file a HITL item + a backlog ticket for things only a human can
#                 do (provision a secret value, DNS, cloud quota, destructive data).
#
# Model discipline (per the user's ask): the cheap model DECIDES, Opus only FIXES.
# Determinism guard: a deterministic "hard outage" floor (deployment unavailable,
# endpoint down, live CrashLoop/ImagePullBackOff) forces escalation even if the
# cheap model flakes and says healthy.
#
# Env (set by TerMinal; all have sane fallbacks so it also runs by hand):
#   TERMINAL_REPO / TERMINAL_WORKTREE   repo + worktree paths
#   AIX_NAMESPACE      k8s namespace (default: aix)
#   AIX_KUBE_CONTEXT   kube context (default: the gauntlet DOKS sfo2 cluster)
#   AIX_HEALTH_URL     public URL to probe (default: https://aix.trevormil.com)
#   OPENROUTER_API_KEY required for the cheap triage (or-exec)
#   K8S_HEALTH_DRY_RUN =1 → gather + triage + print verdict, but never escalate.
set -uo pipefail

repo="${TERMINAL_REPO:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
worktree="${TERMINAL_WORKTREE:-$repo}"
ns="${AIX_NAMESPACE:-aix}"
ctx="${AIX_KUBE_CONTEXT:-do-sfo2-k8s-1-35-1-do-3-sfo2-1777411058629}"
url="${AIX_HEALTH_URL:-https://aix.trevormil.com}"
dry="${K8S_HEALTH_DRY_RUN:-0}"

bin="$repo/.claude/bin"
act() { "$bin/activity" "$@" >/dev/null 2>&1 || true; }

command -v kubectl >/dev/null || { echo "k8s-health: kubectl not on PATH" >&2; exit 2; }
command -v jq >/dev/null || { echo "k8s-health: jq not on PATH" >&2; exit 2; }

# Pin the context only if it actually exists on this host; else fall back to the
# current context so a manual run on a differently-named kubeconfig still works.
kctx=()
if kubectl config get-contexts -o name 2>/dev/null | grep -qxF "$ctx"; then
  kctx=(--context "$ctx")
fi
kc() { kubectl "${kctx[@]}" -n "$ns" "$@"; }

# ---------------------------------------------------------------------------
# 1. Deterministic gather (cheap; no LLM tokens).
# ---------------------------------------------------------------------------
if ! pods_json=$(kc get pods -o json 2>/dev/null); then
  # Can't even reach the cluster/namespace — that itself needs a human.
  act error "k8s-health · cannot reach namespace $ns" "@ context ${ctx}"
  "$bin/hitl" "AIx k8s: cluster/namespace unreachable" \
    "Check kube access to context '$ctx' namespace '$ns' (VPN? kubeconfig? cluster down?)" \
    "k8s-health could not run 'kubectl -n $ns get pods'." || true
  exit 1
fi

deploy_json=$(kc get deploy -o json 2>/dev/null || echo '{"items":[]}')

pods_wide=$(kc get pods -o wide 2>/dev/null | head -60)
deploy_tbl=$(kc get deploy -o wide 2>/dev/null)
cron_tbl=$(kc get cronjob 2>/dev/null)
warn_events=$(kc get events --field-selector type=Warning --sort-by=.lastTimestamp 2>/dev/null | tail -25)

# Public endpoint probe.
http_code=$(curl -sS -o /dev/null -m 12 -w '%{http_code}' "$url" 2>/dev/null || echo "000")

# Deterministic HARD-outage floor.
deploy_unavailable=$(jq -r '[.items[]
  | select((.spec.replicas // 1) > (.status.availableReplicas // 0))
  | .metadata.name] | join(",")' <<<"$deploy_json")

crashers=$(jq -r '[.items[]
  | select(.status.phase != "Succeeded")
  | . as $p
  | (.status.containerStatuses // [])[]
  | select((.state.waiting.reason // "") as $r
      | ($r == "CrashLoopBackOff" or $r == "ImagePullBackOff" or $r == "ErrImagePull"))
  | $p.metadata.name] | unique | join(",")' <<<"$pods_json")

endpoint_down=false
[[ "$http_code" =~ ^[23] ]] || endpoint_down=true

hard=false
[[ -n "$deploy_unavailable" ]] && hard=true
[[ -n "$crashers" ]] && hard=true
$endpoint_down && hard=true

# ---------------------------------------------------------------------------
# 2. Cheap-model triage (or-exec → strict JSON verdict).
# ---------------------------------------------------------------------------
snapshot="NAMESPACE: $ns    ENDPOINT($url): HTTP $http_code

PODS:
$pods_wide

DEPLOYMENTS:
$deploy_tbl

CRONJOBS:
$cron_tbl

RECENT WARNING EVENTS (last 25):
$warn_events

DETERMINISTIC HARD SIGNALS:
- deployments not fully available: ${deploy_unavailable:-none}
- pods crash/imagepull looping right now: ${crashers:-none}
- public endpoint down: $endpoint_down (HTTP $http_code)"

triage_prompt="You are an SRE triaging the live Kubernetes state of the 'aix' app
(a web Deployment 'aix-web' that owns a SQLite PVC, a Discord bot Deployment
'aix-bot', and CronJobs aix-scanner/aix-rank/aix-queue). Below is a kubectl
snapshot. Decide if anything is ACTUALLY wrong right now.

Judgement rules:
- Completed / Succeeded job pods and OLD Error pods from past CronJob runs are
  NORMAL clutter, NOT a problem — ignore them unless the LATEST job of a cronjob
  is failing repeatedly.
- 'FailedToRetrieveImagePullSecret' warnings are benign if images still pull
  (public images) and pods are Running — do not treat as an outage on their own.
- A Deployment that is not fully Available, a public endpoint that is down, a pod
  in CrashLoopBackOff/ImagePullBackOff, or repeated OOMKills ARE real problems.
- 'auto_fix' = an operator could fix it with kubectl (rollout restart, delete a
  stuck pod, re-apply manifests, bump a resource limit) or a small manifest edit.
- 'hitl' = only a human can resolve it (missing/expired secret VALUE, DNS, cloud
  quota/billing, a destructive data decision).

Snapshot:
$snapshot

Respond with ONE line of minified JSON, nothing else, exactly this shape:
{\"status\":\"healthy|degraded|unhealthy\",\"summary\":\"one sentence\",\"action\":\"none|auto_fix|hitl\",\"fix_kind\":\"operational|manifest|none\",\"fix_plan\":\"concrete steps for the operator, or empty\",\"hitl_reason\":\"why a human is needed, or empty\"}"

# or-exec is a `bun` shebang and TerMinal does not inject the decrypted key or
# ~/.bun/bin into a script agent's env — harden PATH so bun is found, and locate
# the key from the env or, failing that, the TerMinal-decrypted mirror if present.
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
orexec="$HOME/.claude/bin/or-exec"; [[ -x "$orexec" ]] || orexec="$HOME/.config/TerMinal/bin/or-exec"

verdict=""
triage_reason=""
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  triage_reason="OPENROUTER_API_KEY not in agent env"
elif ! command -v bun >/dev/null 2>&1; then
  triage_reason="bun not on PATH (or-exec needs it)"
elif [[ ! -x "$orexec" ]]; then
  triage_reason="or-exec not found"
else
  or_err=$(mktemp)
  raw=$(printf '%s' "$triage_prompt" | "$orexec" 2>"$or_err") || true
  verdict=$(printf '%s' "$raw" | sed -e 's/^```json//' -e 's/^```//' -e 's/```$//' | jq -c . 2>/dev/null || true)
  [[ -z "$verdict" ]] && triage_reason="or-exec: $(tail -1 "$or_err" 2>/dev/null | cut -c1-160)"
  rm -f "$or_err"
fi
[[ -n "$triage_reason" ]] && echo "cheap triage skipped → $triage_reason" >&2

# Deterministic fallback if the cheap model was unavailable or returned garbage.
if [[ -z "$verdict" ]]; then
  if $hard; then
    verdict=$(jq -cn --arg s "hard signals (cheap triage skipped: ${triage_reason}): deploy=${deploy_unavailable:-none} crash=${crashers:-none} endpoint=$http_code" \
      '{status:"unhealthy",summary:$s,action:"auto_fix",fix_kind:"operational",fix_plan:"Investigate and restore the failing workloads.",hitl_reason:""}')
  else
    verdict=$(jq -cn --arg r "$triage_reason" \
      '{status:"healthy",summary:("no deterministic hard signals; cheap triage skipped: "+$r),action:"none",fix_kind:"none",fix_plan:"",hitl_reason:""}')
  fi
fi

status=$(jq -r '.status // "unknown"' <<<"$verdict")
action=$(jq -r '.action // "none"' <<<"$verdict")
summary=$(jq -r '.summary // ""' <<<"$verdict")
fix_kind=$(jq -r '.fix_kind // "none"' <<<"$verdict")
fix_plan=$(jq -r '.fix_plan // ""' <<<"$verdict")
hitl_reason=$(jq -r '.hitl_reason // ""' <<<"$verdict")

# Determinism floor: a real outage must never be downgraded to 'none' by a flaky
# cheap model. Force at least an auto_fix escalation.
if $hard && [[ "$action" == "none" ]]; then
  action="auto_fix"; status="unhealthy"
  [[ -n "$fix_plan" ]] || fix_plan="Restore failing workloads: deploy=${deploy_unavailable:-none} crash=${crashers:-none} endpoint=$http_code"
fi

act check "k8s-health · $status · $action" "$summary"
echo "verdict: $verdict"

if [[ "$dry" == "1" ]]; then
  echo "[dry-run] would take action: $action"
  exit 0
fi

# ---------------------------------------------------------------------------
# 3. Route.
# ---------------------------------------------------------------------------
case "$action" in
  none)
    echo "Healthy — nothing to do."
    exit 0
    ;;

  hitl)
    "$bin/hitl" "AIx k8s: needs a human ($status)" \
      "${hitl_reason:-$summary}" \
      "$summary"$'\n\n'"$snapshot" || true
    ntid="$repo/.claude/skills/ticket/bin/next-ticket-id"
    if [[ -x "$ntid" ]]; then
      id=$("$ntid" 2>/dev/null || true)
      if [[ -n "$id" ]]; then
        f="$repo/.TerMinal/backlog/${id}-k8s-health-$(echo "$summary" | tr ' [:upper:]' '-[:lower:]' | tr -cd 'a-z0-9-' | cut -c1-40).md"
        {
          echo "---"
          echo "id: $id"
          echo "title: \"k8s-health: ${summary}\""
          echo "status: stuck"
          echo "priority: high"
          echo "horizon: now"
          echo "agent_id: k8s-health"
          echo "agent_scope: repo"
          echo "agent_kind: classic"
          echo "---"
          echo
          echo "Automated k8s-health run flagged an issue only a human can resolve."
          echo
          echo "**Human action needed:** ${hitl_reason:-$summary}"
          echo
          echo '```'
          echo "$snapshot"
          echo '```'
        } >"$f"
        act ticket-filed "k8s-health filed #$id" "$summary" || true
        echo "Filed HITL + ticket #$id."
      fi
    fi
    exit 0
    ;;

  auto_fix)
    fix_prompt="You are a FORCE autonomous SRE keeping the AIx production app alive on
Kubernetes (namespace '$ns', DOKS context '$ctx'). You have FULL permission this
run: run kubectl (apply -k k8s/, rollout restart, delete stuck pods, scale, bump
limits), rebuild+push images, and commit+push fixes — TERMINAL_FORCE_MAIN=1 is
set so you MAY push a hotfix straight to main to keep prod alive.

A cheap triage model flagged this and proposed a fix:
  status:   $status
  summary:  $summary
  fix_kind: $fix_kind
  fix_plan: $fix_plan

Live snapshot:
$snapshot

Do this:
1. Confirm the problem is real (re-run 'kubectl -n $ns get pods' etc). If it was
   a false alarm (stale completed-job pods, benign warnings), stop and say so.
2. Apply the SMALLEST fix that restores health:
   - Operational: kubectl rollout restart / delete the stuck pod / re-apply
     'kubectl apply -k k8s/' / adjust a resource limit.
   - Manifest bug in k8s/*.yaml: edit it surgically, 'kubectl apply -k k8s/',
     then commit with a 'fix(k8s): ...' message and push. Prefer a feature
     branch + PR when there is no live outage; push a hotfix straight to main
     ONLY for an active outage (FORCE is authorized). Never touch unrelated code.
3. VERIFY: re-check pods are Running/Ready, deployments Available, and
   'curl -I $url' returns 2xx/3xx before you finish.
4. If you cannot fix it because only a human can (a secret VALUE, DNS, cloud
   quota/billing, a destructive data migration), run:
     $bin/hitl \"AIx k8s: <what> needs a human\" \"<action>\" \"<detail>\"
   and file a backlog ticket, then stop.
Keep every change surgical and scope-respecting. Report what you changed and the
verification output."

    echo "Escalating to Opus (FORCE) to auto-fix…"
    TERMINAL_FORCE_MAIN=1 claude -p "$fix_prompt" \
      --permission-mode bypassPermissions \
      --model opus \
      >/tmp/k8s-health-fix.$$.log 2>&1
    rc=$?
    tail -40 /tmp/k8s-health-fix.$$.log
    rm -f /tmp/k8s-health-fix.$$.log

    # Post-fix re-probe as a safety net.
    sleep 5
    new_code=$(curl -sS -o /dev/null -m 12 -w '%{http_code}' "$url" 2>/dev/null || echo "000")
    still_bad=$(kc get deploy -o json 2>/dev/null | jq -r '[.items[]
      | select((.spec.replicas // 1) > (.status.availableReplicas // 0))
      | .metadata.name] | join(",")')
    if [[ -n "$still_bad" || ! "$new_code" =~ ^[23] ]]; then
      act error "k8s-health · fix incomplete" "deploy=$still_bad endpoint=$new_code"
      "$bin/hitl" "AIx k8s: auto-fix did not fully restore health" \
        "Manual look needed — unavailable=[$still_bad] endpoint=HTTP $new_code" \
        "$summary"$'\n\n'"Fix attempt exit=$rc" || true
    else
      act task-complete "k8s-health · auto-fixed" "endpoint HTTP $new_code, deployments available"
    fi
    exit 0
    ;;

  *)
    echo "Unknown action '$action' — treating as no-op."
    exit 0
    ;;
esac
