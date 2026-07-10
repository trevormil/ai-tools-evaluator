import { describe, expect, test } from "bun:test";
import { extractListings, detailReadme, toDiscovered, createSkillsSource } from "./skills";

const listing = (over = {}) => ({
  id: "vercel-labs/skills/find-skills",
  slug: "find-skills",
  name: "find-skills",
  source: "vercel-labs/skills",
  installs: 24531,
  installUrl: "https://github.com/vercel-labs/skills",
  url: "https://skills.sh/vercel-labs/skills/find-skills",
  ...over,
});

describe("parsing", () => {
  test("extractListings tolerates array / {skills} / {data} wrappers", () => {
    expect(extractListings([listing()])).toHaveLength(1);
    expect(extractListings({ skills: [listing(), listing()] })).toHaveLength(2);
    expect(extractListings({ data: [listing()] })).toHaveLength(1);
    expect(extractListings({ nope: 1 })).toEqual([]);
  });

  test("detailReadme concatenates file contents", () => {
    const md = detailReadme({ files: [{ path: "SKILL.md", contents: "# Find Skills\nDoes X." }] });
    expect(md).toContain("### SKILL.md");
    expect(md).toContain("Does X.");
  });
});

describe("toDiscovered", () => {
  test("maps a listing to a skill-kind item with installs as upvotes", () => {
    const d = toDiscovered(listing(), "# SKILL.md\ncontent")!;
    expect(d.source.kind).toBe("skill");
    expect(d.source.externalId).toBe("vercel-labs/skills/find-skills");
    expect(d.source.url).toBe("https://skills.sh/vercel-labs/skills/find-skills");
    expect(d.source.upvotes).toBe(24531);
    expect(d.readme).toContain("Installs: 24531");
    expect(d.readme).toContain("content"); // the SKILL.md is the evaluator's readme
  });

  test("returns null when required fields are missing", () => {
    expect(toDiscovered({ name: "x" }, "")).toBeNull(); // no id
    expect(toDiscovered({ id: "a/b/c" }, "")).toBeNull(); // no name/slug
  });
});

describe("createSkillsSource", () => {
  test("sends the bearer token, fetches trending + each skill's files", async () => {
    const auths: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      auths.push(String((init?.headers as Record<string, string>)?.Authorization ?? ""));
      if (url.includes("detail=")) {
        return new Response(
          JSON.stringify({ files: [{ path: "SKILL.md", contents: "the skill body" }] }),
        );
      }
      return new Response(
        JSON.stringify({ skills: [listing({ id: "a/b/one" }), listing({ id: "a/b/two" })] }),
      );
    }) as unknown as typeof fetch;

    const src = createSkillsSource({
      proxyUrl: "https://proxy.test/api/skills",
      token: "sekret",
      fetchImpl,
    });
    const out = await src.discoverTrending!(5);
    expect(out.map((d) => d.source.externalId)).toEqual(["a/b/one", "a/b/two"]);
    expect(out[0]!.readme).toContain("the skill body"); // detail fetched + inlined
    expect(auths.every((a) => a === "Bearer sekret")).toBe(true); // token on every call
  });

  test("discovery returns [] on a proxy error (never throws into the scan)", async () => {
    const fetchImpl = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    const src = createSkillsSource({
      proxyUrl: "https://proxy.test/api/skills",
      token: "t",
      fetchImpl,
    });
    expect(await src.discoverTrending!(5)).toEqual([]);
  });
});
