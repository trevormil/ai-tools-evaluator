/**
 * Filterable taxonomy for discovered items. Two orthogonal axes:
 *
 *  - `category`   — WHAT the thing is (notetaking, MCP server, library, paper…)
 *  - `integration`— HOW it relates to an AI coding agent like Claude, i.e. the
 *                   "surface area" it touches. This is the axis that powers the
 *                   headline question: is this just a skill, a plugin, or does it
 *                   change your entire workflow?
 *
 * Both are closed enums so filtering stays cheap and the schema stays strict.
 */

export const CATEGORIES = [
  "agent-framework", // orchestration / autonomous agent scaffolds
  "mcp-server", // Model Context Protocol servers
  "cli-tool", // developer CLIs
  "ide-extension", // editor / IDE plugins
  "library", // language libraries / SDKs
  "notetaking", // knowledge capture, PKM, memory
  "prompt-engineering", // prompt libs, eval harnesses, prompt tooling
  "rag", // retrieval, vector, embeddings
  "model", // model weights / releases / fine-tunes
  "dataset", // datasets / benchmarks
  "paper", // research papers
  "devtools", // build, test, lint, infra, observability
  "ui-generation", // design-to-code, component/UI gen
  "data-pipeline", // ETL, scraping, ingestion
  "security", // sec tooling, scanners, guardrails
  "productivity", // general workflow / automation
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * How the item plugs into an agentic workflow. Ordered roughly by how much of
 * your workflow it changes — this is the spine of the "is it worth it?" verdict.
 */
export const INTEGRATION_KINDS = [
  "skill", // a slash-command / skill: additive, low commitment
  "plugin", // an extension/plugin to an existing tool
  "mcp", // exposes tools/resources over MCP
  "library", // you import it into your own code
  "standalone-app", // a separate app you run alongside
  "workflow-shift", // changes how you fundamentally work
  "knowledge", // a paper/idea, not runnable software
] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

export const ITEM_KINDS = [
  "github_repo",
  "arxiv_paper",
  "external_link",
  "producthunt",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  "agent-framework": "Agent Framework",
  "mcp-server": "MCP Server",
  "cli-tool": "CLI Tool",
  "ide-extension": "IDE Extension",
  library: "Library",
  notetaking: "Notetaking",
  "prompt-engineering": "Prompt Engineering",
  rag: "RAG / Retrieval",
  model: "Model",
  dataset: "Dataset / Benchmark",
  paper: "Paper",
  devtools: "Dev Tools",
  "ui-generation": "UI Generation",
  "data-pipeline": "Data Pipeline",
  security: "Security",
  productivity: "Productivity",
  other: "Other",
};
