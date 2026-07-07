import { describe, expect, test } from "bun:test";
import { loadEnv, requireLiveSecrets } from "./env";

const base = { GITHUB_TOKEN: "g", AIX_INTERNAL_TOKEN: "t" };

describe("requireLiveSecrets — model provider", () => {
  test("accepts OPENROUTER_API_KEY as the model provider", () => {
    const env = loadEnv({ ...base, OPENROUTER_API_KEY: "o" });
    expect(() => requireLiveSecrets(env)).not.toThrow();
  });

  test("still accepts ANTHROPIC_API_KEY as the model provider", () => {
    const env = loadEnv({ ...base, ANTHROPIC_API_KEY: "a" });
    expect(() => requireLiveSecrets(env)).not.toThrow();
  });

  test("fails when neither provider key is set", () => {
    const env = loadEnv({ ...base });
    expect(() => requireLiveSecrets(env)).toThrow(/OPENROUTER_API_KEY.*ANTHROPIC_API_KEY/);
  });
});

describe("empty env strings are treated as absent (k8s envFrom placeholders)", () => {
  test("empty ANTHROPIC_API_KEY parses to undefined and does not block an OpenRouter run", () => {
    const env = loadEnv({ ...base, OPENROUTER_API_KEY: "o", ANTHROPIC_API_KEY: "" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(() => requireLiveSecrets(env)).not.toThrow();
  });

  test("an empty provider-only env still fails (both keys empty ≈ absent)", () => {
    const env = loadEnv({ ...base, OPENROUTER_API_KEY: "", ANTHROPIC_API_KEY: "" });
    expect(() => requireLiveSecrets(env)).toThrow(/OPENROUTER_API_KEY.*ANTHROPIC_API_KEY/);
  });
});

describe("AIX_MODEL default", () => {
  test("defaults to a cheap non-Opus model", () => {
    const env = loadEnv({ ...base });
    expect(env.AIX_MODEL).not.toMatch(/opus/i);
    expect(env.AIX_MODEL).toBe("google/gemini-3.1-flash-lite");
  });
});
