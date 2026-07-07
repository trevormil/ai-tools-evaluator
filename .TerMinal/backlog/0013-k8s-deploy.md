---
id: 013
title: "k8s: manifests for web, scanner CronJob, bot, PVC, ingress, secrets"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ADR-0002, ARCH]
depends_on: [0002,0010,0012]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Namespace aix; web Deployment (replicas:1) + Service + Ingress (aix.trevormil.com, cert-manager letsencrypt-prod, nginx) + PVC for SQLite; scanner CronJob (daily); bot Deployment; Secret manifests. Match cluster conventions (ghcr-pull).

## Acceptance
- kubectl apply -k k8s/ stands up all resources; ingress serves TLS; scanner runs on schedule.
