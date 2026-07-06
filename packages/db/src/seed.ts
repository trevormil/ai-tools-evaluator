/**
 * Seed the AIx database with real, hand-authored evaluations of well-known
 * tools/repos/papers — the product's voice, in the product's own schema.
 *
 * Idempotent: skips items whose (kind, externalId) already exist, reuses the
 * `aixbot` / `aixdemo` users, and only seeds the social feed once. Each item is
 * validated with `Evaluation.parse` and mirrored to `content/items/<slug>.md`.
 *
 *   AIX_DB_PATH=./aix.db bun src/seed.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { and, eq } from "drizzle-orm";
import {
  Evaluation,
  computeOverall,
  toMarkdown,
  type Evaluation as Eval,
  type MetricKey,
} from "@aix/core";
import { getDb, items, users, posts, comments, stackItems, activities } from "@aix/db";

/* -------------------------------------------------------- hot ranking (local)
 * Mirrors apps/web/lib/ranking.ts. Duplicated (a few lines) so the seed doesn't
 * reach across into the web app; the hourly rank CronJob keeps it authoritative. */
const EPOCH = 1_700_000_000;
function hotScore(net: number, createdAtSec: number): number {
  const order = Math.log10(Math.max(Math.abs(net), 1));
  const sign = net > 0 ? 1 : net < 0 ? -1 : 0;
  return sign * order + (createdAtSec - EPOCH) / 45000;
}

const nowSec = Math.floor(Date.now() / 1000);
const DAY = 86_400;

type Score = { score: number; rationale: string };
const s = (score: number, rationale: string): Score => ({ score, rationale });

/** Build a full, validated Evaluation from the hand-authored fields. */
function make(input: {
  slug: string;
  source: Eval["source"];
  category: Eval["category"];
  integration: Eval["integration"];
  tags: string[];
  verdict: Eval["verdict"];
  noiseScore: number;
  audience: Eval["audience"];
  scores: Record<MetricKey, Score>;
  tagline: string;
  body: Eval["body"];
  quickstart?: Eval["quickstart"];
  decision?: Eval["decision"];
  evaluatedAt: string;
}): Eval {
  const overallScore = computeOverall(input.scores);
  return Evaluation.parse({
    schemaVersion: 1,
    slug: input.slug,
    source: input.source,
    category: input.category,
    integration: input.integration,
    tags: input.tags,
    verdict: input.verdict,
    noiseScore: input.noiseScore,
    audience: input.audience,
    scores: input.scores,
    overallScore,
    tagline: input.tagline,
    body: input.body,
    quickstart: input.quickstart,
    decision: input.decision,
    media: [],
    evaluatedBy: "human",
    evaluatedAt: input.evaluatedAt,
  });
}

const at = (daysAgo: number) => new Date((nowSec - daysAgo * DAY) * 1000).toISOString();

/* ------------------------------------------------------------- the evaluations */

const EVALUATIONS: { eval: Eval; daysAgo: number; upvotes: number; comments: number }[] = [
  {
    daysAgo: 1,
    upvotes: 214,
    comments: 3,
    eval: make({
      slug: "ripgrep",
      source: {
        kind: "github_repo",
        externalId: "BurntSushi/ripgrep",
        url: "https://github.com/BurntSushi/ripgrep",
        title: "ripgrep (rg)",
        author: "Andrew Gallant",
        description:
          "Recursively search directories for a regex pattern while respecting your gitignore.",
        stars: 49000,
        language: "Rust",
        license: "MIT",
      },
      category: "cli-tool",
      integration: "standalone-app",
      tags: ["cli", "rust", "search", "grep"],
      verdict: "essential",
      noiseScore: 4,
      audience: {
        primary: "both",
        aiEngineerFit: 95,
        vibeCoderFit: 78,
        rationale:
          "Anyone touching a codebase — human or agent — greps constantly. rg is the fastest, most correct grep and the one your agent should reach for by default.",
      },
      scores: {
        novelty: s(
          55,
          "Not a new idea — it's grep. The novelty is engineering: gitignore-aware, Unicode-correct, and absurdly fast.",
        ),
        utility: s(
          98,
          "You use it dozens of times an hour without noticing. Pure daily-driver leverage.",
        ),
        deltaVsBaseline: s(
          88,
          "GNU grep works, but rg's speed and gitignore defaults change how aggressively you search.",
        ),
        easeOfAdoption: s(
          95,
          "One binary, no config, drop-in for grep. `brew install ripgrep` and you're done.",
        ),
        maturity: s(
          97,
          "Battle-tested for years, ships inside VS Code, rock-solid release history.",
        ),
        leanness: s(96, "A single static binary. Zero moving parts, no daemon, no runtime."),
        traction: s(
          94,
          "49k stars, embedded in editors and countless tools. The de-facto standard.",
        ),
        composability: s(92, "Line-oriented, scriptable, JSON output. Pipes into everything."),
        longevity: s(
          90,
          "Search isn't getting absorbed by a model. This is infrastructure for the next decade.",
        ),
        clarity: s(
          88,
          "Excellent docs and a famously thorough author. The man page actually helps.",
        ),
      },
      tagline:
        "The fastest grep, gitignore-aware by default — the one search tool your agent should reach for first.",
      body: {
        whatItIs:
          "ripgrep is a command-line search tool that recursively searches directories for a regex pattern. It respects .gitignore by default, skips binary and hidden files, is Unicode-aware, and is written in Rust on top of a fast regex engine. In practice it's a drop-in, much faster replacement for grep/ack/ag.",
        vsVanilla:
          "A capable agent can already call grep. The difference is that rg's defaults match how a developer actually wants to search — ignoring node_modules, .git, and build artifacts without being told — so the agent gets relevant hits instead of ten thousand lines of vendored noise. Speed matters too: on a large repo the latency difference is the difference between an agent searching freely and rationing its searches.",
        surfaceArea:
          "Standalone binary, not a plugin or skill. It touches your workflow at the lowest possible level: it's the tool that every other tool and agent shells out to. That's exactly why it's worth standardizing on — the surface area is tiny and universal.",
        devilsAdvocate:
          "The honest counter is that grep is already installed everywhere and a model doesn't care about a 200ms difference on a small repo. If your agent only ever greps a handful of files, ripgrep buys you nothing a POSIX grep wouldn't. And 'just install another binary' is real friction in locked-down or containerized environments where you don't control the toolchain. It is not novel — it's a very good implementation of a 50-year-old idea, and treating it as exciting is exactly the kind of tool-worship AIx exists to puncture.",
        steelman:
          "But the gitignore-awareness alone changes agent behavior for the better, and the speed removes a real reason to under-search. It's the rare tool that's both boring and genuinely load-bearing. Adopt it and forget about it.",
      },
      quickstart: {
        install: "brew install ripgrep",
        requires: ["macOS/Linux (or cargo/choco on others)"],
      },
      decision: {
        adoptIf: [
          "Your agent or you grep large repos many times an hour",
          "You want node_modules/.git noise gone with zero config",
        ],
        skipIf: [
          "You only search a handful of files in locked-down environments",
          "You can't install binaries where your agent runs",
        ],
        insteadOf: "grep / ack / ag",
      },
      evaluatedAt: at(1),
    }),
  },
  {
    daysAgo: 2,
    upvotes: 187,
    comments: 2,
    eval: make({
      slug: "zod",
      source: {
        kind: "github_repo",
        externalId: "colinhacks/zod",
        url: "https://github.com/colinhacks/zod",
        title: "Zod",
        author: "Colin McDonnell",
        description: "TypeScript-first schema validation with static type inference.",
        stars: 34000,
        language: "TypeScript",
        license: "MIT",
      },
      category: "library",
      integration: "library",
      tags: ["typescript", "validation", "schema", "types"],
      verdict: "essential",
      noiseScore: 8,
      audience: {
        primary: "ai-engineer",
        aiEngineerFit: 93,
        vibeCoderFit: 60,
        rationale:
          "If you write TypeScript that touches untrusted input — API bodies, env vars, LLM output — Zod is the parse-don't-validate boundary. For agent tool-calling it's how you make model output type-safe.",
      },
      scores: {
        novelty: s(
          70,
          "Runtime-checked schemas that also infer static types wasn't obvious before Zod made it ergonomic.",
        ),
        utility: s(
          95,
          "Every boundary in a real app needs validation. Zod covers it with one source of truth.",
        ),
        deltaVsBaseline: s(
          80,
          "Hand-rolled type guards work but rot; Zod keeps the type and the check in sync automatically.",
        ),
        easeOfAdoption: s(90, "One dependency, fluent API, zero config. Productive in minutes."),
        maturity: s(
          88,
          "Widely deployed, stable API, huge ecosystem of adapters (tRPC, forms, OpenAPI).",
        ),
        leanness: s(
          72,
          "Small but not free — the fluent chains add bundle weight and some inference cost at scale.",
        ),
        traction: s(93, "The default validation library for TS. Enormous adoption."),
        composability: s(90, "Schemas compose, refine, and transform; adapters everywhere."),
        longevity: s(
          85,
          "TypeScript isn't going anywhere and runtime validation is a permanent need.",
        ),
        clarity: s(84, "Docs are good; error messages are decent and improving."),
      },
      tagline:
        "The parse-don't-validate boundary for TypeScript — and how you make LLM tool-call output type-safe.",
      body: {
        whatItIs:
          "Zod is a TypeScript-first schema declaration and validation library. You define a schema once and get both a runtime validator and a static type inferred from it, so parsed data is typed correctly without a separate interface. It handles nested objects, unions, refinements, transforms, and produces structured errors.",
        vsVanilla:
          "A base agent writing TypeScript can hand-write type guards or cast `as` and hope. Zod removes the hope: the runtime check and the compile-time type are the same declaration, so they can't drift. For AI-specific work it's the standard way to validate a model's JSON tool-call arguments before you act on them — this very codebase parses every Evaluation through Zod at the trust boundary.",
        surfaceArea:
          "It's a library you import, not a workflow change. But it quietly shapes architecture: once you parse at the edges, the interior of your app can assume clean, typed data. That's a real structural benefit, not just a convenience.",
        devilsAdvocate:
          "The pushback: for tiny scripts, Zod is overkill — a JSON.parse and a couple of `if` checks are lighter and have zero dependencies. At scale, Zod's inference can balloon TypeScript compile times and its runtime isn't free on hot paths. There are leaner alternatives (Valibot, ArkType) with smaller bundles, so 'reach for Zod reflexively' can be its own trap. And a capable agent can generate correct validators by hand, so the library is a convenience, not a capability the model lacks.",
        steelman:
          "Still, the single-source-of-truth property is worth the weight for anything that ships. The moment your data has more than a couple of shapes, hand-rolled guards become the liability Zod was built to remove.",
      },
      quickstart: {
        install: "bun add zod",
        requires: ["TypeScript project"],
      },
      decision: {
        adoptIf: [
          "You accept LLM/tool-call JSON and act on it",
          "Your app has more than a couple of data shapes crossing boundaries",
        ],
        skipIf: [
          "It's a tiny script — JSON.parse and two ifs are lighter",
          "Bundle size or hot-path validation cost is your constraint",
        ],
        insteadOf: "hand-rolled type guards / joi / yup",
      },
      evaluatedAt: at(2),
    }),
  },
  {
    daysAgo: 3,
    upvotes: 156,
    comments: 4,
    eval: make({
      slug: "react-reasoning-and-acting",
      source: {
        kind: "arxiv_paper",
        externalId: "2210.03629",
        url: "https://arxiv.org/abs/2210.03629",
        title: "ReAct: Synergizing Reasoning and Acting in Language Models",
        authors: [
          "Shunyu Yao",
          "Jeffrey Zhao",
          "Dian Yu",
          "Nan Du",
          "Izhak Shafran",
          "Karthik Narasimhan",
          "Yuan Cao",
        ],
        description: "Interleaving chain-of-thought reasoning with tool-use actions in LLMs.",
        publishedAt: "2022-10-06T00:00:00.000Z",
      },
      category: "paper",
      integration: "knowledge",
      tags: ["agents", "reasoning", "tool-use", "prompting"],
      verdict: "essential",
      noiseScore: 6,
      audience: {
        primary: "ai-engineer",
        aiEngineerFit: 90,
        vibeCoderFit: 25,
        rationale:
          "This is the mental model under every tool-using agent you run today. You don't need to cite it to build, but understanding the reason-act-observe loop makes you far better at designing and debugging agents.",
      },
      scores: {
        novelty: s(
          88,
          "Framing reasoning traces and actions as one interleaved loop was a genuine conceptual unlock in 2022.",
        ),
        utility: s(
          78,
          "You don't run a paper, but its loop is the backbone of every agent framework and harness in production.",
        ),
        deltaVsBaseline: s(
          72,
          "Modern models do ReAct-style reasoning implicitly; the paper's value is now conceptual, not a technique you add.",
        ),
        easeOfAdoption: s(
          70,
          "It's an idea — free to adopt, but you have to translate it into your own harness.",
        ),
        maturity: s(
          80,
          "Peer-reviewed, endlessly cited, and absorbed into the field's common vocabulary.",
        ),
        leanness: s(85, "A pattern, not code. It adds understanding, not moving parts."),
        traction: s(
          92,
          "One of the most-cited agent papers; the name is now shorthand for the whole approach.",
        ),
        composability: s(
          75,
          "The loop underlies most frameworks, so the idea composes with everything.",
        ),
        longevity: s(
          70,
          "Foundational as history, but frontier models increasingly internalize it — the explicit pattern may fade.",
        ),
        clarity: s(
          82,
          "Clearly written with concrete task examples; approachable for practitioners.",
        ),
      },
      tagline:
        "The reason-act-observe loop behind every tool-using agent you run — essential as understanding, not as code.",
      body: {
        whatItIs:
          "ReAct is a 2022 paper showing that interleaving free-form reasoning ('thoughts') with concrete actions (tool calls) and observations lets a language model plan, act, and adjust in one loop. Instead of reasoning in a vacuum or acting blindly, the model alternates: think, do, observe the result, think again. It's the canonical formulation of the agent loop.",
        vsVanilla:
          "A modern base agent already does much of this implicitly — today's models reason and call tools without being prompted into a rigid ReAct scaffold. So the paper isn't a technique you bolt on anymore; it's the conceptual model that explains why your agent behaves the way it does, and what to fix when the loop breaks (bad observations, no re-planning, runaway thoughts).",
        surfaceArea:
          "This is knowledge, not software. You can't install it. Its 'integration' is into your head: it changes how you design harnesses, budget context for observations, and reason about where an agent goes wrong.",
        devilsAdvocate:
          "The devil's advocate is strong here: as a thing to actively use in 2025, ReAct is largely obsolete. Frontier models were trained on ReAct-style traces and now do it natively, so explicitly forcing a rigid Thought/Action/Observation format often makes agents worse, not better — it's cargo-culting a scaffold the model no longer needs. Citing ReAct as if implementing it were an achievement is a tell that someone learned agents from 2022 blog posts. Its value today is purely historical and conceptual; treating it as a live engineering recipe is a mistake.",
        steelman:
          "That said, understanding the loop is genuinely load-bearing. When an agent spirals, the fix is almost always in the reason-act-observe cycle — starving observations, never re-planning, or acting before reasoning. Knowing the pattern by name makes those failures legible.",
      },
      evaluatedAt: at(3),
    }),
  },
  {
    daysAgo: 4,
    upvotes: 98,
    comments: 5,
    eval: make({
      slug: "github-mcp-server",
      source: {
        kind: "github_repo",
        externalId: "github/github-mcp-server",
        url: "https://github.com/github/github-mcp-server",
        title: "GitHub MCP Server",
        author: "GitHub",
        description: "Official Model Context Protocol server exposing the GitHub API to agents.",
        stars: 15000,
        language: "Go",
        license: "MIT",
      },
      category: "mcp-server",
      integration: "mcp",
      tags: ["mcp", "github", "api", "go"],
      verdict: "worthwhile",
      noiseScore: 32,
      audience: {
        primary: "ai-engineer",
        aiEngineerFit: 80,
        vibeCoderFit: 55,
        rationale:
          "If your agent lives in issues and PRs, this gives it first-class GitHub access without you writing glue. Worthwhile when GitHub is central to your loop; skippable if you just use `gh` on the CLI.",
      },
      scores: {
        novelty: s(
          45,
          "It's the GitHub REST API over MCP. The novelty is the protocol plumbing, not the capability.",
        ),
        utility: s(
          82,
          "Real leverage for agents that triage issues, review PRs, and manage releases.",
        ),
        deltaVsBaseline: s(
          55,
          "A capable agent can already shell out to the `gh` CLI; MCP mainly buys structured, typed access.",
        ),
        easeOfAdoption: s(
          78,
          "Official, documented, and a standard MCP config away — but you still manage a token and a server process.",
        ),
        maturity: s(80, "Backed by GitHub, actively maintained, sensible scoping."),
        leanness: s(
          58,
          "Adds a running server and an OAuth/token surface — real moving parts vs. just using `gh`.",
        ),
        traction: s(
          85,
          "Fast adoption; the reference example people point to for 'a good MCP server.'",
        ),
        composability: s(80, "Standard MCP, so it drops into any MCP-aware client cleanly."),
        longevity: s(72, "GitHub isn't going anywhere; MCP as the transport is the open question."),
        clarity: s(82, "Good README and tool descriptions; the tools are self-explanatory."),
      },
      tagline:
        "First-class GitHub for agents over MCP — real leverage if issues/PRs are your loop, redundant with `gh` if not.",
      body: {
        whatItIs:
          "The official Model Context Protocol server for GitHub. It exposes GitHub's API — issues, pull requests, repos, actions, code search — as typed MCP tools an agent can call directly. Point an MCP-aware client at it, supply a token, and your agent can read and act on GitHub without you writing integration code.",
        vsVanilla:
          "The base agent can already run `gh` on the command line and get most of this. What the MCP server adds is structured, typed tool definitions and scoped access, so the model gets clean JSON and a discoverable tool surface instead of parsing CLI output. That's a real but incremental win — it's better ergonomics on top of a capability the agent basically already has.",
        surfaceArea:
          "This is an MCP integration: a separate server process the agent talks to over the protocol. It sits between 'plugin' and 'standalone app' — you run and authenticate it once, then any MCP client can use it. The surface area is a server plus a token to manage.",
        devilsAdvocate:
          "The hard question: what does this do that `gh` piped to your agent doesn't? For most workflows, not much. You're trading a zero-setup CLI the model already knows how to drive for a running server, a token to scope and rotate, and another process to keep alive. MCP's promise is cross-client reuse, but if you only use one client, that promise is unrealized and you've added operational overhead for structured output you could get with `gh --json`. It is not novel capability — it is a nicer wrapper around an API the agent could already reach.",
        steelman:
          "When GitHub genuinely is your agent's home — an autonomous triage or review bot running unattended — typed tools and scoped tokens beat parsing CLI text, and the official server means you're not maintaining that glue yourself. In that setting it earns its keep.",
      },
      evaluatedAt: at(4),
    }),
  },
  {
    daysAgo: 5,
    upvotes: 76,
    comments: 6,
    eval: make({
      slug: "dspy",
      source: {
        kind: "github_repo",
        externalId: "stanfordnlp/dspy",
        url: "https://github.com/stanfordnlp/dspy",
        title: "DSPy",
        author: "Stanford NLP",
        description:
          "Programming — not prompting — foundation models. Compile declarative modules into optimized prompts.",
        stars: 22000,
        language: "Python",
        license: "MIT",
      },
      category: "prompt-engineering",
      integration: "library",
      tags: ["python", "prompting", "optimization", "evals"],
      verdict: "worthwhile",
      noiseScore: 38,
      audience: {
        primary: "ai-engineer",
        aiEngineerFit: 85,
        vibeCoderFit: 20,
        rationale:
          "For engineers who treat prompts as artifacts to optimize against a metric — not vibe-tune by hand — DSPy is a genuinely different paradigm. Overkill for one-off prompting; powerful for pipelines you measure.",
      },
      scores: {
        novelty: s(
          85,
          "Treating prompts as compiled, optimizable programs against a metric is a real paradigm shift.",
        ),
        utility: s(
          72,
          "High for measured multi-stage pipelines; low if you're writing a single prompt.",
        ),
        deltaVsBaseline: s(
          78,
          "Automated prompt/weight optimization does something hand-prompting genuinely can't do consistently.",
        ),
        easeOfAdoption: s(
          50,
          "Steep learning curve — you must think in signatures, modules, and metrics, not prompts.",
        ),
        maturity: s(
          65,
          "Active and improving, but the API has churned and the abstractions are still moving.",
        ),
        leanness: s(
          48,
          "Introduces a whole programming model and optimizer state — significant conceptual and runtime weight.",
        ),
        traction: s(
          78,
          "Strong academic and practitioner interest; 22k stars and real production use.",
        ),
        composability: s(
          70,
          "Modules compose well internally; less so with non-DSPy prompting code.",
        ),
        longevity: s(
          68,
          "The idea (optimize, don't hand-tune) has legs; whether DSPy is the winning implementation is open.",
        ),
        clarity: s(
          60,
          "Concepts are deep and the docs demand real investment; not a skim-and-go library.",
        ),
      },
      tagline:
        "Compile prompts against a metric instead of hand-tuning them — a real paradigm, and real overkill for one-offs.",
      body: {
        whatItIs:
          "DSPy is a framework for building LLM pipelines as declarative modules with typed input/output 'signatures,' then compiling them: an optimizer searches over prompt phrasings (and optionally few-shot examples or weights) to maximize a metric you define on a dev set. The pitch is 'program, don't prompt' — you specify what each stage should do and let DSPy tune how.",
        vsVanilla:
          "A base agent hand-writes and hand-tunes prompts, iterating by feel. DSPy replaces that loop with measured optimization: given examples and a metric, it improves the prompts for you and re-optimizes when you swap models. That's a capability the vanilla approach doesn't have — systematic, metric-driven prompt optimization rather than intuition.",
        surfaceArea:
          "It's a library, but adopting it is closer to a workflow shift: you stop writing prompts and start writing modules, metrics, and datasets. That reframing is the whole point and also the cost — DSPy only pays off if you buy into building and maintaining eval sets.",
        devilsAdvocate:
          "The skeptic's case is serious. DSPy asks you to learn a dense abstraction layer to solve a problem — 'my prompt could be a bit better' — that, for most teams, isn't the bottleneck. The optimizer needs a labeled dev set and a good metric; if you don't have those (most people don't), you get complexity with none of the payoff. Frontier models are now good enough that careful manual prompting gets you 90% of the way, and the API has churned enough to burn early adopters. For a single prompt or a small pipeline, DSPy is a heavyweight solution to a lightweight problem — the definition of a complexity trap if adopted reflexively.",
        steelman:
          "But if you run a multi-stage pipeline in production and can define a real metric, DSPy does something you otherwise do badly by hand: it keeps the whole chain optimized as models and data shift. For teams already living in evals, that's a durable win, not a gimmick.",
      },
      evaluatedAt: at(5),
    }),
  },
  {
    daysAgo: 6,
    upvotes: 41,
    comments: 2,
    eval: make({
      slug: "logseq",
      source: {
        kind: "github_repo",
        externalId: "logseq/logseq",
        url: "https://github.com/logseq/logseq",
        title: "Logseq",
        author: "Logseq",
        description:
          "A privacy-first, open-source knowledge base on local plain-text Markdown and Org files.",
        stars: 34000,
        language: "Clojure",
        license: "AGPL-3.0",
      },
      category: "notetaking",
      integration: "standalone-app",
      tags: ["pkm", "notes", "markdown", "local-first"],
      verdict: "niche",
      noiseScore: 45,
      audience: {
        primary: "both",
        aiEngineerFit: 55,
        vibeCoderFit: 50,
        rationale:
          "A good local-first PKM for people who think in outlines and backlinks. Niche because it's a personal-workflow choice, not an AI-engineering tool — its relevance to agents is that your notes stay as plain Markdown.",
      },
      scores: {
        novelty: s(
          50,
          "Outliner + backlinks + local Markdown is a well-trodden space (Roam, Obsidian). Execution, not invention.",
        ),
        utility: s(
          68,
          "Genuinely useful if outline-based networked notes fit your brain; irrelevant if they don't.",
        ),
        deltaVsBaseline: s(
          40,
          "For most, a folder of Markdown files an agent can read does 80% of this with none of the app.",
        ),
        easeOfAdoption: s(
          65,
          "Free and local, but the block/outline model has a real learning curve and some rough edges.",
        ),
        maturity: s(
          58,
          "Capable but historically buggy; the DB rewrite has been a long, disruptive transition.",
        ),
        leanness: s(55, "A full desktop app for what is, underneath, a pile of Markdown files."),
        traction: s(70, "Sizable, devoted community; a leading open-source PKM."),
        composability: s(
          72,
          "Plain-text storage means your notes stay portable and agent-readable — the best thing about it.",
        ),
        longevity: s(
          55,
          "PKM apps come and go; the plain-text files will outlive the app, which is the point.",
        ),
        clarity: s(
          62,
          "Docs are decent; the conceptual model (blocks, not pages) trips up newcomers.",
        ),
      },
      tagline:
        "Local-first outliner PKM on plain Markdown — nice if outlines fit your brain, a folder of notes if they don't.",
      body: {
        whatItIs:
          "Logseq is an open-source, privacy-first knowledge base built around an outliner: everything is a nested block, notes link to each other with [[backlinks]], and it all lives in local plain-text Markdown or Org files you own. Think Roam Research, but local-first and open-source.",
        vsVanilla:
          "This isn't really competing with a base agent — it's a personal notes app. Its only agent-relevant property is that because storage is plain Markdown on disk, an agent can read and search your notes directly without an API. Contrast a proprietary app whose notes are locked in a database: Logseq keeps your knowledge in files any tool can touch.",
        surfaceArea:
          "A standalone desktop/mobile app you run alongside your work. It doesn't integrate with an agent workflow so much as sit next to it; the integration point is the filesystem where the Markdown lives.",
        devilsAdvocate:
          "The honest critique: for most developers, Logseq is a heavyweight answer to 'where do I keep notes' when a folder of Markdown files plus ripgrep — or your editor — already does the job, and stays just as agent-readable. The block-outliner model is polarizing; plenty of people bounce off it. The app has been historically buggy, and the multi-year database rewrite has been disruptive to the very users who invested in it. If you don't specifically want networked-outline thinking, this is a lot of app for a problem plain files already solve. That's what pins it at niche.",
        steelman:
          "For people whose thinking genuinely is networked and outline-shaped, the backlink graph plus local ownership is a real, durable workflow — and keeping it all in plain text means you never get locked in. That combination is rare and worth it for that audience.",
      },
      evaluatedAt: at(6),
    }),
  },
  {
    daysAgo: 7,
    upvotes: 63,
    comments: 7,
    eval: make({
      slug: "bolt-new",
      source: {
        kind: "github_repo",
        externalId: "stackblitz/bolt.new",
        url: "https://github.com/stackblitz/bolt.new",
        title: "bolt.new",
        author: "StackBlitz",
        description:
          "Prompt, run, edit, and deploy full-stack web apps entirely in the browser via an in-browser Node runtime.",
        stars: 14000,
        language: "TypeScript",
        license: "MIT",
      },
      category: "ui-generation",
      integration: "standalone-app",
      tags: ["ui-gen", "webcontainers", "fullstack", "prototyping"],
      verdict: "niche",
      noiseScore: 52,
      audience: {
        primary: "vibe-coder",
        aiEngineerFit: 45,
        vibeCoderFit: 82,
        rationale:
          "A slick in-browser 'describe an app, watch it build and run' experience. Great for non-experts and fast prototypes; for an engineer with a real agent in their editor it's a demo, not a workflow.",
      },
      scores: {
        novelty: s(
          72,
          "Running a full Node toolchain in the browser (WebContainers) to build-and-run generated apps live is genuinely clever.",
        ),
        utility: s(
          62,
          "Fast for zero-to-prototype; limited once you need to leave the sandbox and own the code.",
        ),
        deltaVsBaseline: s(
          48,
          "An agent in your own editor generates the same app with your real tools and no sandbox ceiling.",
        ),
        easeOfAdoption: s(
          88,
          "Open a URL, type a prompt, watch it run. Nothing to install — the whole appeal.",
        ),
        maturity: s(60, "Impressive but sandbox-bound; complex or long-lived projects hit walls."),
        leanness: s(
          58,
          "Zero local footprint, but you're inside someone else's environment with its constraints.",
        ),
        traction: s(
          80,
          "Big launch splash and strong ongoing interest in the 'prompt-to-app' category.",
        ),
        composability: s(
          45,
          "The browser sandbox is the point and the cage — it doesn't compose with your local toolchain.",
        ),
        longevity: s(
          50,
          "The whole prompt-to-app category is being commoditized fast by every coding agent.",
        ),
        clarity: s(70, "The experience explains itself; that immediacy is the product."),
      },
      tagline:
        "Prompt-to-full-stack-app live in the browser — magic for prototypes, a walled garden for real projects.",
      body: {
        whatItIs:
          "bolt.new lets you describe a web app in a prompt and watch an AI build, run, and let you edit it entirely in the browser. It uses StackBlitz's WebContainers to run a real Node.js toolchain client-side, so the generated app actually executes and previews live, and you can deploy from there. It's a prompt-to-app studio with no local setup.",
        vsVanilla:
          "A capable coding agent in your own editor generates the same kind of app — but writes to your real filesystem, with your real tools, no sandbox ceiling, and full ownership of the result. bolt.new's edge is the zero-setup, runs-instantly-in-the-browser loop, which is fantastic for someone without a dev environment. For an engineer who already has an agent wired into their editor, that convenience is mostly redundant.",
        surfaceArea:
          "A standalone web app, not something you integrate into an existing workflow. You go to it; it doesn't come to you. That's ideal for a quick throwaway and awkward the moment you want the code in your own repo with your own agent.",
        devilsAdvocate:
          "The skeptical read: bolt.new is a beautifully packaged demo of a capability that every coding agent now has. The instant it builds something real, you want to pull the code into your own environment — at which point the sandbox that made it magical becomes the thing you're escaping. WebContainers are impressive engineering, but the prompt-to-app layer on top is exactly the commodity the base models are absorbing fastest. It optimizes the first five minutes of a project and has little to say about the next five months. As a serious tool for a working engineer it's thin; its real audience is non-coders and demos, which is why it lands at niche.",
        steelman:
          "For non-engineers, educators, or a designer sketching an interactive idea, the no-install, runs-instantly loop is genuinely enabling — it removes the entire environment-setup wall that stops most people before they start. Within that audience, it's excellent.",
      },
      evaluatedAt: at(7),
    }),
  },
  {
    daysAgo: 8,
    upvotes: 52,
    comments: 8,
    eval: make({
      slug: "llamaindex",
      source: {
        kind: "github_repo",
        externalId: "run-llama/llama_index",
        url: "https://github.com/run-llama/llama_index",
        title: "LlamaIndex",
        author: "LlamaIndex",
        description: "A data framework for building RAG and agent applications over your own data.",
        stars: 37000,
        language: "Python",
        license: "MIT",
      },
      category: "rag",
      integration: "library",
      tags: ["rag", "retrieval", "python", "vectors"],
      verdict: "marginal",
      noiseScore: 58,
      audience: {
        primary: "ai-engineer",
        aiEngineerFit: 62,
        vibeCoderFit: 30,
        rationale:
          "A comprehensive RAG toolkit that gets you a demo fast — and then abstracts away the exact retrieval details you need to control in production. Fine for prototyping; a liability if you mistake it for the finished system.",
      },
      scores: {
        novelty: s(
          40,
          "Bundles known RAG techniques (chunk, embed, retrieve, rerank) behind one API; convenience, not invention.",
        ),
        utility: s(
          65,
          "Real leverage for a quick RAG prototype; diminishing once you need to tune each stage.",
        ),
        deltaVsBaseline: s(
          45,
          "The core loop — embed, store, retrieve, stuff context — is a few hundred lines you can own and understand.",
        ),
        easeOfAdoption: s(
          75,
          "Five lines to a working demo. That accessibility is exactly the seduction.",
        ),
        maturity: s(
          62,
          "Widely used but sprawling; the surface area and abstraction churn are real maintenance costs.",
        ),
        leanness: s(
          35,
          "Enormous surface area and a deep abstraction stack to hide what is, underneath, fairly simple plumbing.",
        ),
        traction: s(80, "37k stars and heavy adoption; a default name in the RAG conversation."),
        composability: s(
          55,
          "Many integrations, but its abstractions can fight the lower-level libraries you'd rather call directly.",
        ),
        longevity: s(
          58,
          "RAG matters; whether you want it behind this much framework is the open question.",
        ),
        clarity: s(
          50,
          "Vast docs, but the layers of abstraction make it hard to know what's actually happening on a query.",
        ),
      },
      tagline:
        "A RAG toolkit that demos in five lines and hides the retrieval details you'll need to control in production.",
      body: {
        whatItIs:
          "LlamaIndex is a Python (and TypeScript) data framework for building retrieval-augmented generation and agent apps over your own documents. It provides loaders, chunking, embeddings, vector-store integrations, query engines, and rerankers behind a high-level API, so you can go from a pile of documents to a queryable index quickly.",
        vsVanilla:
          "A capable agent can assemble RAG from primitives — an embedding call, a vector store, a retrieval query, and a prompt that stuffs the results — in a few hundred lines you fully understand. LlamaIndex packages all of that so you skip the wiring. The trade is control: the framework decides chunking, retrieval, and prompt assembly unless you dig through its abstractions to override them, which is precisely where production RAG lives or dies.",
        surfaceArea:
          "It's a library, but a maximalist one — adopting it means adopting its worldview of documents, nodes, indices, and query engines. That's more of a workflow commitment than a typical import, and unwinding it later is real work.",
        devilsAdvocate:
          "The critique that lands it at marginal: LlamaIndex makes the easy 80% trivial and the hard 20% — the part that actually matters — harder. Production RAG quality is all in the details of chunking, retrieval strategy, reranking, and how context is assembled. A framework that hides those behind a five-line demo lets you ship something that looks done and retrieves badly, and then you're reverse-engineering the abstraction to fix what you'd have controlled directly if you'd written the ~300 lines yourself. The core RAG loop is not hard to own, and owning it means you understand every retrieval decision. Reaching for this much framework for something that simple is how RAG projects accrue complexity they can't debug.",
        steelman:
          "For a fast internal prototype or to survey the space of loaders and integrations, LlamaIndex genuinely saves time, and its breadth of connectors is a real asset when you just need to ingest something odd. Used as scaffolding you'll later replace — not as the permanent foundation — it's fine.",
      },
      evaluatedAt: at(8),
    }),
  },
  {
    daysAgo: 9,
    upvotes: 129,
    comments: 11,
    eval: make({
      slug: "langchain",
      source: {
        kind: "github_repo",
        externalId: "langchain-ai/langchain",
        url: "https://github.com/langchain-ai/langchain",
        title: "LangChain",
        author: "LangChain",
        description: "A framework for developing applications powered by large language models.",
        stars: 95000,
        language: "Python",
        license: "MIT",
      },
      category: "agent-framework",
      integration: "library",
      tags: ["agents", "python", "framework", "orchestration"],
      verdict: "complexity-trap",
      noiseScore: 74,
      audience: {
        primary: "neither",
        aiEngineerFit: 40,
        vibeCoderFit: 35,
        rationale:
          "Enormous mindshare, but for most projects it adds layers of abstraction over a few direct API calls. Serious engineers increasingly rip it out; beginners drown in its indirection. Great tutorials, heavy production tax.",
      },
      scores: {
        novelty: s(
          35,
          "Early on it named useful patterns (chains, agents); today those patterns are a few lines of plain code.",
        ),
        utility: s(
          45,
          "Fast for a tutorial demo; a tax the moment you need to debug or customize what it's doing.",
        ),
        deltaVsBaseline: s(
          30,
          "Most of what LangChain does is a direct API call plus a loop — the abstraction adds indirection, not capability.",
        ),
        easeOfAdoption: s(
          40,
          "Easy to start, hard to master: sprawling API, leaky abstractions, and heavy version churn.",
        ),
        maturity: s(
          50,
          "Massive but unstable — frequent breaking changes and a reputation for churn have burned teams.",
        ),
        leanness: s(
          20,
          "The canonical example of too many moving parts: deep abstraction stacks over simple LLM calls.",
        ),
        traction: s(
          90,
          "95k stars, ubiquitous in tutorials — traction is the one thing it undeniably has.",
        ),
        composability: s(
          38,
          "Composes beautifully with itself and awkwardly with everything you'd rather call directly.",
        ),
        longevity: s(
          42,
          "As base models absorb orchestration, the case for a heavy framework keeps shrinking.",
        ),
        clarity: s(
          45,
          "Voluminous docs, but the abstraction layers obscure what actually happens on any given call.",
        ),
      },
      tagline:
        "The most-starred way to turn three API calls into ten abstractions — great tutorials, a real production tax.",
      body: {
        whatItIs:
          "LangChain is a framework for building LLM applications. It provides abstractions — chains, agents, tools, memory, retrievers, prompt templates — meant to compose into pipelines without wiring everything by hand. It's the most-starred project in the space and the default entry point for a huge number of developers building their first LLM app.",
        vsVanilla:
          "Here's the problem: most of what LangChain abstracts is a direct model API call inside a loop. A base agent writes that loop in a few readable lines you fully control. LangChain replaces those lines with layers — a chain wrapping an agent wrapping a tool wrapping the call — so that when something breaks, you debug the framework instead of your logic. It rarely adds capability the model doesn't have; it adds indirection between you and the model.",
        surfaceArea:
          "Nominally a library, but in practice a workflow commitment: adopt LangChain and your whole app is shaped by its abstractions, its data types, and its update cadence. Backing out later means rewriting the parts you routed through it — which is exactly what a growing number of teams end up doing.",
        devilsAdvocate:
          "This is the archetypal complexity trap, so the devil's advocate is the whole case. LangChain sells the feeling of productivity — look how few lines to a working agent — while quietly making the important work harder. The abstractions are leaky: to do anything non-trivial you must understand both your problem and LangChain's model of it, then fight the framework when they disagree. Its version churn has repeatedly broken production code. And the core value proposition erodes every month, because the thing it orchestrates — reasoning, tool use, planning — is exactly what frontier models keep absorbing natively. The tell is how many experienced teams describe their architecture as 'we started with LangChain and then ripped it out.' For most projects, writing the loop yourself is less code, more debuggable, and more durable.",
        steelman:
          "In fairness: for rapid prototyping, teaching, or gluing together many exotic integrations you don't want to write connectors for, LangChain's breadth is a genuine shortcut, and LangGraph is a more honest attempt at real orchestration. As disposable scaffolding it can earn a place — the trap is mistaking it for the foundation.",
      },
      quickstart: {
        install: "pip install langchain",
        requires: ["Python 3.9+", "provider API key (OpenAI/Anthropic/…)"],
      },
      decision: {
        adoptIf: [
          "You're prototyping and need many exotic integrations glued fast",
          "You're teaching LLM app concepts and want ready-made scaffolding",
        ],
        skipIf: [
          "You're building anything you intend to keep — write the loop",
          "You need to debug what actually happens on each model call",
          "Version churn in a core dependency is unacceptable to you",
        ],
        insteadOf: "the raw provider SDK + a loop",
      },
      evaluatedAt: at(9),
    }),
  },
  {
    daysAgo: 10,
    upvotes: 88,
    comments: 9,
    eval: make({
      slug: "autogpt",
      source: {
        kind: "github_repo",
        externalId: "Significant-Gravitas/AutoGPT",
        url: "https://github.com/Significant-Gravitas/AutoGPT",
        title: "AutoGPT",
        author: "Significant Gravitas",
        description: "An experimental open-source attempt to make GPT-4 fully autonomous.",
        stars: 168000,
        language: "Python",
        license: "MIT",
      },
      category: "agent-framework",
      integration: "standalone-app",
      tags: ["agents", "autonomous", "python", "orchestration"],
      verdict: "complexity-trap",
      noiseScore: 82,
      audience: {
        primary: "neither",
        aiEngineerFit: 30,
        vibeCoderFit: 28,
        rationale:
          "The viral face of 'fully autonomous agents,' and the clearest lesson in why unbounded autonomy loops fail: they spiral, burn tokens, and rarely finish. Historically important, practically a cautionary tale.",
      },
      scores: {
        novelty: s(
          55,
          "In 2023 the 'set a goal, let it run forever' loop was a striking demo; the idea aged faster than almost anything.",
        ),
        utility: s(
          28,
          "Rarely completes a real task without spiraling, looping, or wandering off. Impressive to watch, hard to trust.",
        ),
        deltaVsBaseline: s(
          25,
          "A single well-scoped agent turn with a human in the loop beats an unbounded autonomous spiral on almost every real task.",
        ),
        easeOfAdoption: s(
          45,
          "Easy to launch, hard to get useful output from; you spend more time babysitting than it saves.",
        ),
        maturity: s(
          48,
          "Has pivoted repeatedly (now a platform); the original autonomous-agent promise never became reliable.",
        ),
        leanness: s(
          22,
          "Maximal moving parts in service of autonomy that usually makes results worse, not better.",
        ),
        traction: s(
          92,
          "168k stars — one of the most-starred repos ever. Traction is entirely the point and entirely the story.",
        ),
        composability: s(35, "Built to run itself, not to slot into your workflow."),
        longevity: s(
          30,
          "The unbounded-autonomy thesis has largely been abandoned in favor of scoped, supervised agents.",
        ),
        clarity: s(
          50,
          "The concept is legible; what it actually does on a given run is anyone's guess.",
        ),
      },
      tagline:
        "The viral 'fully autonomous agent' that taught the field why unbounded autonomy loops spiral and rarely finish.",
      body: {
        whatItIs:
          "AutoGPT is the project that made 'autonomous AI agents' go viral in early 2023: give it a goal, and it loops — planning, spawning sub-tasks, calling tools, and critiquing itself — attempting to reach the objective with no human in the loop. It became one of the most-starred repositories on GitHub almost overnight and has since pivoted toward being an agent-building platform.",
        vsVanilla:
          "A capable base agent, given a scoped task and a human checking its work at sensible intervals, outperforms an unbounded autonomous loop on nearly every real job. AutoGPT's whole premise — remove the human, let it run — is precisely the setting where current agents fail worst: they lose the thread, repeat themselves, rack up token cost, and confidently pursue the wrong subgoal. It doesn't add capability over a supervised agent; it removes the supervision that makes agents useful.",
        surfaceArea:
          "A standalone application you launch and (in theory) walk away from. That 'walk away' is the entire design and the entire problem — it's built to operate without you at exactly the moment you most need to be watching.",
        devilsAdvocate:
          "As a tool to use today, AutoGPT is a complexity trap wearing an autonomy costume. The core lesson the field learned from it is a negative result: unbounded autonomous loops don't reliably complete real tasks, and the more moving parts you add to sustain the illusion of autonomy, the more ways it has to go off the rails. You pay in tokens, wall-clock time, and babysitting for output you then have to redo. The 168k stars measure fascination, not utility — it's the most-starred cautionary tale in AI. Reaching for it because it's famous, expecting reliable autonomous work, is the mistake it exists to warn you about. Scoped tasks with a human gate win.",
        steelman:
          "Its genuine value is historical and pedagogical: AutoGPT ran the 'full autonomy' experiment loudly and in public, and the field's move toward scoped, supervised, human-in-the-loop agents is largely a reaction to watching it fail. As an artifact that taught everyone what not to build, it more than earned its place.",
      },
      evaluatedAt: at(10),
    }),
  },
];

/* --------------------------------------------------------------------- runner */

function upsertUser(
  username: string,
  role: "user" | "bot",
  displayName: string,
  bio: string,
): string {
  const db = getDb();
  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing) return existing.id;
  const row = db.insert(users).values({ username, role, displayName, bio }).returning().get();
  return row.id;
}

function contentDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..", "content", "items");
}

function seed() {
  const db = getDb();

  const botId = upsertUser(
    "aixbot",
    "bot",
    "AIx",
    "The resident skeptic. I distill trending repos, tools, and papers into a harsh verdict.",
  );
  const demoId = upsertUser("aixdemo", "user", "Dana (demo)", "Kicking the tires on AIx.");

  const dir = contentDir();
  mkdirSync(dir, { recursive: true });

  let inserted = 0;
  let skipped = 0;

  for (const entry of EVALUATIONS) {
    const e = entry.eval;
    const kind = e.source.kind;
    const externalId = e.source.externalId;

    const existing = db
      .select()
      .from(items)
      .where(and(eq(items.kind, kind), eq(items.externalId, externalId)))
      .get();

    // Always (re)write the .md artifact so content/ stays in sync with the seed.
    writeFileSync(join(dir, `${e.slug}.md`), toMarkdown(e), "utf8");

    if (existing) {
      skipped++;
      continue;
    }

    const createdAt = nowSec - entry.daysAgo * DAY;
    const cover = e.media.find((m) => m.type === "image");
    db.insert(items)
      .values({
        slug: e.slug,
        kind,
        externalId,
        url: e.source.url,
        title: e.source.title,
        category: e.category,
        integration: e.integration,
        verdict: e.verdict,
        primaryAudience: e.audience.primary,
        aiEngineerFit: e.audience.aiEngineerFit,
        vibeCoderFit: e.audience.vibeCoderFit,
        overallScore: e.overallScore,
        noiseScore: e.noiseScore,
        tagline: e.tagline,
        tagsJson: JSON.stringify(e.tags),
        evaluationJson: JSON.stringify(e),
        mediaJson: JSON.stringify(e.media),
        coverImageUrl: cover ? (cover.cachedUrl ?? cover.url) : null,
        evaluatedBy: e.evaluatedBy,
        model: e.model ?? null,
        postedById: botId,
        published: true,
        score: hotScore(entry.upvotes, createdAt),
        upvotes: entry.upvotes,
        commentCount: entry.comments,
        scoredAt: createdAt, // seeded items were "judged" at createdAt (recap grouping)
        createdAt,
      })
      .run();
    inserted++;
  }

  // --- Repo README (shown "in their own words" on the item page). Seeded for
  // ripgrep so local/e2e runs render the section without a network fetch.
  const RIPGREP_README = `# ripgrep (rg)

ripgrep is a line-oriented search tool that recursively searches the current
directory for a regex pattern. By default, ripgrep will respect gitignore rules
and automatically skip hidden files/directories and binary files.

## Quick example

\`\`\`bash
rg 'fn run' --type rust
\`\`\`

## Why should I use ripgrep?

- It can replace many use cases served by other search tools because it
  contains most of their features and is generally faster.
- It respects your .gitignore out of the box.
- It is Unicode-aware while remaining fast.
`;
  db.update(items)
    .set({ readmeMd: RIPGREP_README })
    .where(and(eq(items.slug, "ripgrep"), eq(items.published, true)))
    .run();

  // --- Nightly recap cluster (ticket 0040): put a varied set of verdicts on the
  // current UTC day so "tonight's recap" is a real multi-tool night in demos.
  const midnight = nowSec - (nowSec % 86_400);
  const recapCluster: [string, number][] = [
    ["ripgrep", 0],
    ["zod", 120],
    ["react-reasoning-and-acting", 240],
    ["llamaindex", 360],
    ["langchain", 480],
  ];
  for (const [slug, offset] of recapCluster) {
    db.update(items)
      .set({ scoredAt: midnight + offset })
      .where(eq(items.slug, slug))
      .run();
  }

  // --- Social feed: only seed once (idempotent on the demo user having no posts).
  const hasPosts = db.select().from(posts).where(eq(posts.authorId, demoId)).get();
  let socialInserted = 0;
  if (!hasPosts) {
    const langchain = db.select().from(items).where(eq(items.slug, "langchain")).get();
    const ripgrep = db.select().from(items).where(eq(items.slug, "ripgrep")).get();

    const p1 = db
      .insert(posts)
      .values({
        authorId: demoId,
        itemId: langchain?.id ?? null,
        body: "The LangChain 'complexity-trap' verdict is exactly right. Started a project on it, ripped it out three weeks later, shipped 200 fewer lines. What's everyone's replacement — just the raw SDK + a loop?",
        upvotes: 34,
        commentCount: 2,
        createdAt: nowSec - 2 * DAY,
      })
      .returning()
      .get();

    const p2 = db
      .insert(posts)
      .values({
        authorId: demoId,
        itemId: ripgrep?.id ?? null,
        body: "Underrated take: half of 'agent tooling' is just giving the model ripgrep and getting out of the way. Boring infra beats clever frameworks.",
        upvotes: 27,
        commentCount: 1,
        createdAt: nowSec - 1 * DAY,
      })
      .returning()
      .get();

    db.insert(comments)
      .values([
        {
          authorId: botId,
          postId: p1.id,
          body: "The pattern we keep seeing: teams describe their architecture as 'we started with LangChain and then ripped it out.' The raw SDK plus a well-scoped loop is more code you actually understand.",
          upvotes: 12,
          createdAt: nowSec - 2 * DAY + 3600,
        },
        {
          authorId: demoId,
          postId: p1.id,
          body: "Yeah — LangGraph is a more honest attempt at real orchestration, but for most apps the loop is the whole framework.",
          upvotes: 6,
          createdAt: nowSec - 2 * DAY + 7200,
        },
        {
          authorId: botId,
          postId: p2.id,
          body: "gitignore-aware search changes agent behavior more than most 'MCP servers' do. Cheap, invisible, load-bearing.",
          upvotes: 9,
          createdAt: nowSec - 1 * DAY + 1800,
        },
      ])
      .run();

    socialInserted = 2;

    // Takes — the social primitive (ticket 0036): honest blurbs on tools the
    // demo users run, plus feed activities so the home pulse rail is alive.
    const zod = db.select().from(items).where(eq(items.slug, "zod")).get();
    const takeSeeds = [
      {
        userId: demoId,
        item: ripgrep,
        status: "using",
        rating: 5,
        take: "In every repo I touch. The agent finds the right code on the first try instead of grepping node_modules for a minute.",
        at: nowSec - 1 * DAY + 4000,
      },
      {
        userId: demoId,
        item: zod,
        status: "using",
        rating: 4,
        take: "Every LLM tool-call boundary in our stack goes through a zod schema. Malformed model output stopped being a production incident.",
        at: nowSec - 3600 * 5,
      },
      {
        userId: botId,
        item: langchain,
        status: "dropped",
        rating: 2,
        take: "Ran it for two quarters. The abstractions aged worse than the code they replaced — back to the raw SDK.",
        at: nowSec - 3600 * 2,
      },
    ] as const;
    for (const t of takeSeeds) {
      if (!t.item) continue;
      db.insert(stackItems)
        .values({
          userId: t.userId,
          itemId: t.item.id,
          status: t.status,
          rating: t.rating,
          take: t.take,
          createdAt: t.at,
          updatedAt: t.at,
        })
        .run();
      db.insert(activities)
        .values({
          actorId: t.userId,
          verb: "stack_added",
          objectType: "item",
          objectId: t.item.id,
          createdAt: t.at,
        })
        .run();
    }
  }

  console.log(
    `seed complete: ${inserted} items inserted, ${skipped} skipped (already present); ` +
      `${socialInserted} posts seeded; artifacts written to ${dir}`,
  );
}

if (import.meta.main) {
  seed();
}
