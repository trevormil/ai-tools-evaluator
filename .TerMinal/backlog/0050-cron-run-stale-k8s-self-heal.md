---
id: 0050
title: "Cron run stale: K8s self-heal"
status: open
priority: high
type: bug
source: cron-fail
created: 2026-07-10
updated: 2026-07-10
---

The scheduled run for **K8s self-heal** (branch `cron/k8s-health-1783626891255-402d`) was swept by the watchdog because the wrapper process (pid 57073) is dead after 248 min.

- run id: `402d6ee4-e6fd-45bd-8415-269884f0e25a`
- log: `~/.config/TerMinal/cron-runs/402d6ee4-e6fd-45bd-8415-269884f0e25a.log`
- worktree: `/Users/trevormiller/.config/TerMinal/cron-worktrees/ai-tools-evaluator/747C2211-DF2E-4005-802D-3C974F773A37-1783626891255-402d`

Investigate why the runner died mid-run (terminal closed, OOM, launchd killed, network hang). Fix the root cause; re-enable the schedule in the Schedules tab if the circuit-breaker tripped.
