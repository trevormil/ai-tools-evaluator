/**
 * Diagnostic (ticket 0083 follow-up): does the eval model actually emit
 * `deepDive` for a substantial README? Calls the real prompt + model once,
 * reports SHAPE ONLY (never prints secrets, never publishes anything).
 *
 *   bun scripts/probe-deepdive.ts [owner/repo]
 */
import { evaluatorSystem, buildEvaluatorPrompt, lensFor, sanitizeEvaluationDraft, EvaluationDraft } from "../packages/core/src/index";
import { createOpenRouterModel } from "../apps/scanner/src/evaluate";

/** Mirror of the scanner's private extractJson — strip fences, parse. */
function extractJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  return JSON.parse(stripped.slice(start, end + 1));
}

const repo = process.argv[2] ?? "YC-Software/QM";
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY not in env/.env");
const modelName = process.env.AIX_MODEL ?? "deepseek/deepseek-v4-flash";

const gh = await fetch(`https://api.github.com/repos/${repo}`, {
  headers: process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {},
});
const meta = (await gh.json()) as Record<string, unknown>;
const readmeRes = await fetch(`https://api.github.com/repos/${repo}/readme`, {
  headers: {
    accept: "application/vnd.github.raw+json",
    ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  },
});
const readme = await readmeRes.text();
console.log(`repo=${repo} readme_chars=${readme.length} model=${modelName}`);

const source = {
  kind: "github_repo" as const,
  externalId: repo,
  url: `https://github.com/${repo}`,
  title: String(meta.name ?? repo),
  description: typeof meta.description === "string" ? meta.description : undefined,
  stars: typeof meta.stargazers_count === "number" ? meta.stargazers_count : undefined,
  language: typeof meta.language === "string" ? meta.language : undefined,
};

const model = createOpenRouterModel({ apiKey, model: modelName });
const system = evaluatorSystem(lensFor(source));
const user = buildEvaluatorPrompt(source, readme);
const raw = await model.complete(system, user);

const parsedRaw = extractJson(raw) as Record<string, unknown>;
const rawDeep = parsedRaw?.deepDive as Record<string, unknown> | undefined;
console.log("RAW model output:");
console.log("  has deepDive:", !!rawDeep);
if (rawDeep) {
  const arch = rawDeep.architecture as { components?: unknown[]; flows?: unknown[] } | undefined;
  console.log("  howItWorks chars:", typeof rawDeep.howItWorks === "string" ? rawDeep.howItWorks.length : "MISSING");
  console.log("  architecture:", arch ? `${arch.components?.length ?? 0} components, ${arch.flows?.length ?? 0} flows` : "absent");
  console.log("  internals:", Array.isArray(rawDeep.internals) ? rawDeep.internals.length : "absent");
}

const clean = sanitizeEvaluationDraft(parsedRaw) as Record<string, unknown>;
console.log("AFTER sanitize: has deepDive:", !!clean.deepDive);
const check = EvaluationDraft.safeParse(clean);
console.log("draft valid:", check.success, check.success ? "" : JSON.stringify(check.error.issues.slice(0, 3)));
