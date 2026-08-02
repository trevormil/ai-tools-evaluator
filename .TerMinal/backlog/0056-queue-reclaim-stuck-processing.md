---
id: 056
title: "Queue: reclaim orphaned 'processing' submissions (never retried)"
status: in-progress
priority: high
horizon: now
hitl: false
type: bug
source: manual
created: 2026-07-10
updated: 2026-08-02
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/81"]
refs: []
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

The queue drain marks a submission `processing` BEFORE resolve+evaluate+publish.
If that queue job then dies mid-flight (crash, OOM, activeDeadline, or the web
internal API being unreachable), the submission is left in `processing` forever —
and `listQueuedSubmissions` only returns `status = 'queued'`, so it is **never
retried**. The item stays `pending` indefinitely.

Concrete case (2026-07-10): `JustVugg/colibri` (`/item/colibri`) — submission
`0d9b34cb-…` stuck in `processing`, item `pending`. Trigger was the web pod
crash-looping (exit 137 at boot on node `pool-…-3nxdlc`; see #49/#50), so a queue
run couldn't reach the internal API to finish publishing.

Fix: reclaim stale `processing` submissions — on scan start (or in the cap/queue
step), reset submissions whose `processedAt`/updated time is older than N minutes
from `processing` back to `queued`. Consider also widening
`listQueuedSubmissions` to include `processing` older than a threshold. Pairs
with the node-stability work (#49 node headroom, #50 self-heal).

Immediate remediation for colibri (pending approval — it's a prod DB write): reset
its submission to `queued`, e.g. via the running web pod:
`UPDATE submissions SET status='queued' WHERE status='processing';`
