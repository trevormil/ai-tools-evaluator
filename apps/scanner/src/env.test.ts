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
    expect(env.AIX_MODEL).toBe("deepseek/deepseek-v4-flash");
  });
});

describe("trending budgets", () => {
  // Master cap 13 = the 5 GitHub + 5 ProductHunt + 3 skills daily mix; Discord features one.
  test("master cap defaults to 13, per-source to 5+5+3", () => {
    const env = loadEnv({ ...base });
    expect(env.AIX_TRENDING_PICKS).toBe(13);
    expect(env.AIX_TRENDING_PICKS_GITHUB).toBe(5);
    expect(env.AIX_TRENDING_PICKS_PRODUCTHUNT).toBe(5);
    expect(env.AIX_TRENDING_PICKS_SKILLS).toBe(3);
  });

  test("PH + skills sources are optional (absent secret → that source disabled)", () => {
    const env = loadEnv({ ...base });
    expect(env.PRODUCTHUNT_API_TOKEN).toBeUndefined();
    expect(env.SKILLS_PROXY_URL).toBeUndefined();
    expect(env.SKILLS_PROXY_TOKEN).toBeUndefined();
    expect(loadEnv({ ...base, PRODUCTHUNT_API_TOKEN: "tok" }).PRODUCTHUNT_API_TOKEN).toBe("tok");
  });
});
