---
id: 0049
title: "k8s-health: add node memory headroom"
status: icebox
priority: medium
horizon: future
hitl: true
type: chore
source: script
created: 2026-07-09
updated: 2026-07-20
prs: []
refs: []
depends_on: []
agent_id: k8s-health
agent_scope: repo
agent_kind: classic
---

AIx is healthy, but the only DOKS node pool node pool-6jaricb1x-3nxdlc is tight after restoring metrics-server: kubectl top node reports 2761Mi memory used (91%) and describe node reports memory requests 2893Mi/3074896Ki (96%) with limits 7488Mi (249%). Kubelet MemoryPressure is currently False and AIx pods are healthy (aix-web ~643Mi/2Gi, aix-bot ~48Mi/512Mi), but there is little room for Next.js/web spikes or other namespace growth. Proposed fix: human decides whether to resize/add a node, move non-AIx workloads, or lower requests/limits where safe; do not make an app-only manifest change blindly.
