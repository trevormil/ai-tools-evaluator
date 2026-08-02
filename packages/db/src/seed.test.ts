import { describe, expect, test } from "bun:test";
import { Evaluation, LENSES, lensFor, requiredBodySections } from "@aix/core";
import { EVALUATIONS } from "./seed";

/**
 * Seed fixtures drift out of the strict schema whenever a lens gains a required
 * body section (ticket 0066: `research` gained `vsPriorWork`, the ReAct paper
 * fixture didn't get it, and the only symptom was the Playwright web server
 * failing to boot). These assertions move that failure into `bun test`.
 */
describe("seed fixtures satisfy the current @aix/core schema", () => {
  test("every fixture round-trips through Evaluation.parse", () => {
    for (const { eval: e } of EVALUATIONS) {
      expect(() => Evaluation.parse(e)).not.toThrow();
    }
  });

  test("every fixture supplies all required body sections for its lens", () => {
    const missing: string[] = [];
    for (const { eval: e } of EVALUATIONS) {
      const lens = lensFor(e.source);
      for (const key of requiredBodySections(lens)) {
        const value = (e.body as Record<string, unknown>)[key];
        if (typeof value !== "string" || value.trim() === "") {
          missing.push(`${e.slug} (${lens}) is missing body.${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  // Full coverage: a required section added to ANY lens must break a fixture
  // here, in `bun test` — not in a dead e2e web server (tickets 0066/0075).
  test("fixtures cover every lens", () => {
    const covered = new Set(EVALUATIONS.map(({ eval: e }) => lensFor(e.source)));
    expect([...covered].sort()).toEqual([...LENSES].sort());
  });
});
