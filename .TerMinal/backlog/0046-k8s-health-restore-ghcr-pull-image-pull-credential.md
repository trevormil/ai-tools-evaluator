---
id: 0046
title: "k8s-health: restore ghcr-pull image pull credential"
status: in-progress
priority: medium
type: feature
source: script
created: 2026-07-09
updated: 2026-07-09
agent_id: k8s-health
agent_scope: repo
agent_kind: classic
prs:
  - https://github.com/trevormil/ai-tools-evaluator/pull/30
---

Kubernetes is emitting repeated FailedToRetrieveImagePullSecret warnings for ghcr-pull on aix-web, aix-bot, and every aix-queue pod in namespace aix. Images currently pull successfully, so this is not down, but it is a production availability risk if GHCR access changes or anonymous pulls are throttled. Proposed fix: recreate or repair the ghcr-pull docker-registry imagePullSecret with a valid GHCR token, then verify new pods/jobs no longer emit the warning. Related PR for separate web memory drift fix: https://github.com/trevormil/ai-tools-evaluator/pull/29

## Resolution

Investigation found the `ghcr-pull` secret does not exist in the `aix`
namespace at all, and the GHCR packages (`ghcr.io/trevormil/aix-*`) are
**public** — anonymous manifest pulls return `200` and fresh pods pull in
~465ms with no cached-image fallback. So the secret is genuinely unused; the
warning is a dangling `imagePullSecrets` reference, not a missing credential.

Fix chosen (over recreating the secret): drop the `imagePullSecrets: [ghcr-pull]`
reference from web/bot/queue/scanner and document that images are public. No
credential to maintain. If the packages are ever made private, re-add the secret
(k8s/README.md §2 documents how). Not applied live — deploy is human-gated, and
applying the manifests only takes effect on the next rollout/job.
