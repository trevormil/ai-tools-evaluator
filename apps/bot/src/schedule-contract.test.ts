import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_DIGEST_UTC_HOUR } from "./digest";

/**
 * The daily pick only lands at its advertised time if the scan has already
 * published by the time the bot's gate opens. That coupling lives across two
 * files — the scanner CronJob and the bot's gate hour — with nothing enforcing
 * it, and it broke in production on 2026-08-26.
 *
 * The CronJob carried `schedule: "0 13 * * *"` with no `timeZone`, so k3s
 * resolved it against the *host* clock (America/New_York) and scanned at 17:00
 * UTC — four hours after the 13:00 UTC gate. For weeks that was invisible: the
 * bot simply posted the previous day's pick each morning at 13:02 UTC. Then the
 * 2026-08-25 scan published zero items, the morning of the 26th had nothing to
 * post, and the pick slipped to 17:17 UTC (10:17am PT) — where it then stuck,
 * because each day's watermark landed at publish time.
 *
 * These assertions pin the invariant that made it possible.
 */
describe("scanner schedule vs. digest gate", () => {
  const manifest = readFileSync(join(import.meta.dir, "../../../k8s/scanner-cronjob.yaml"), "utf8");

  const schedule = manifest.match(/^\s*schedule:\s*"([^"]+)"/m)?.[1];
  const timeZone = manifest.match(/^\s*timeZone:\s*"([^"]+)"/m)?.[1];

  it("declares an explicit UTC timeZone so it never inherits the node's clock", () => {
    // Without this field the schedule is resolved in kube-controller-manager's
    // local time. On single-node k3s that is the host's /etc/timezone.
    expect(timeZone).toBeDefined();
    expect(["Etc/UTC", "UTC"]).toContain(timeZone);
  });

  it("finishes scanning before the bot's gate hour opens", () => {
    expect(schedule).toBeDefined();
    const [minute, hour] = schedule!.split(" ");
    const scanMinutes = Number(hour) * 60 + Number(minute);
    const gateMinutes = DEFAULT_DIGEST_UTC_HOUR * 60;

    // Strictly before, not equal: starting the scan *at* the gate hour means the
    // post time drifts with scan duration (11s to 13min observed) instead of
    // landing on the gate.
    expect(scanMinutes).toBeLessThan(gateMinutes);

    // And with real headroom — the scan job's own activeDeadlineSeconds is 1800.
    expect(gateMinutes - scanMinutes).toBeGreaterThanOrEqual(30);
  });
});
