---
title: Squash-merging a PR stack in a tight loop races GitHub's retargeting
date: 2026-08-02
tags: [github, stacked-prs, merge, gotcha]
---

# Stacked squash-merges: never loop without waiting for retarget

Landing the #79→#87 stack with `for pr in …; gh pr merge $pr --squash
--delete-branch` half-destroyed it (2026-08-02). Two distinct failure modes,
both from GitHub state lagging the loop:

1. **Deleting a merged base auto-closes its child before retargeting.**
   Merging #79 deleted its branch; child #80 was CLOSED (not retargeted to
   main) by the time the loop reached it. Retargeting does happen — but not
   synchronously with the merge API returning.
2. **Merging a child whose base is still the parent branch merges it INTO the
   parent, not main.** #81/#83/#85 "succeeded" — each squashed into its parent
   feature branch, which then deleted their heads and auto-closed the next
   children (#82/#84/#87). Nothing after #79 reached main.

No content was lost (the stack tip contained everything); recovery was
retargeting the tip PR to main and landing one roll-up squash. But the
per-PR history granularity on main was forfeited.

**Correct procedure for merging a stack bottom-up:**

- Before merging each PR, poll until `gh pr view N --json baseRefName` reports
  `main` (the retarget from the deleted parent has landed) AND
  `mergeable == MERGEABLE`. Only then merge. The original
  `/tmp` merge script did exactly this wait; the raw `for` loop that actually
  ran did not.
- Alternatively, retarget explicitly (`gh pr edit N --base main`) before each
  merge instead of trusting auto-retarget timing.
- If the stack is content-cumulative (each child contains its parents), a
  deliberate roll-up — retarget the tip to main, merge once — is a valid
  simpler landing; the cost is one squashed commit for N PRs.
