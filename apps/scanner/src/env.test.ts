import { describe, expect, test } from "bun:test";
import { loadEnv, requireLiveSecrets } from "./env";

const base = { GITHUB_TOKEN: "g" };

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
  // Master cap 10 = the 5 GitHub + 5 ProductHunt daily mix; Discord features one.
  test("master cap defaults to 10, per-source to 5+5", () => {
    const env = loadEnv({ ...base });
    expect(env.AIX_TRENDING_PICKS).toBe(10);
    expect(env.AIX_TRENDING_PICKS_GITHUB).toBe(5);
    expect(env.AIX_TRENDING_PICKS_PRODUCTHUNT).toBe(5);
  });

  test("PRODUCTHUNT_API_TOKEN is optional (absent → PH disabled, GitHub-only)", () => {
    expect(loadEnv({ ...base }).PRODUCTHUNT_API_TOKEN).toBeUndefined();
    expect(loadEnv({ ...base, PRODUCTHUNT_API_TOKEN: "tok" }).PRODUCTHUNT_API_TOKEN).toBe("tok");
  });
});

describe("DISCORD_WEBHOOK_URL", () => {
  test("is optional (absent → no digest posted)", () => {
    expect(loadEnv({ ...base }).DISCORD_WEBHOOK_URL).toBeUndefined();
  });

  test('empty string reads as absent (Actions injects unset secrets as "")', () => {
    expect(loadEnv({ ...base, DISCORD_WEBHOOK_URL: "" }).DISCORD_WEBHOOK_URL).toBeUndefined();
  });

  test("a valid webhook URL is kept", () => {
    const url = "https://discord.com/api/webhooks/123/abc";
    expect(loadEnv({ ...base, DISCORD_WEBHOOK_URL: url }).DISCORD_WEBHOOK_URL).toBe(url);
  });

  test("rejects a non-URL value", () => {
    expect(() => loadEnv({ ...base, DISCORD_WEBHOOK_URL: "not-a-url" })).toThrow();
  });
});

describe("requireLiveSecrets no longer needs an internal token", () => {
  test("a live run needs only GitHub + a model provider", () => {
    const env = loadEnv({ ...base, OPENROUTER_API_KEY: "o" });
    expect(() => requireLiveSecrets(env)).not.toThrow();
  });
});
