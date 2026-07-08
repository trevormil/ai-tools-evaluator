import type { ItemSource } from "@aix/core";
import { starVelocity } from "./sources/quality-gate";
import type { Discovered } from "./types";

/**
 * Trending score for ranking discovery candidates before we spend an eval.
 * Heavily weighted toward recent **star velocity** (stars/day since creation) so
 * fast-rising GitHub repos float to the top; a small log-stars term breaks ties
 * toward proven repos. Papers / starless repos score 0 (GitHub-first by design).
 */
export function trendingScore(source: ItemSource, now: Date): number {
  const stars = source.stars ?? 0;
  if (stars <= 0) return 0;
  const velocity = starVelocity(
    { stars, archived: false, fork: false, createdAt: source.createdAt },
    now,
  );
  return velocity * 10 + Math.log10(stars + 1);
}

/**
 * Application-affinity signals — the stuff this community actually cares about:
 * *using* coding agents (Claude, Codex, and friends) to build things, plus the
 * app-dev tooling an AI engineer reaches for (agent frameworks, MCP servers,
 * IDE/CLI integrations, SDKs). These get a ranking boost.
 */
const APP_DEV_SIGNALS = [
  "claude",
  "codex",
  "openclaw",
  "hermes",
  "cursor",
  "copilot",
  "aider",
  "cline",
  "windsurf",
  "devin",
  "openhands",
  "swe-agent",
  "sweagent",
  "coding agent",
  "coding-agent",
  "ai coding",
  "code assistant",
  "coding assistant",
  "pair program",
  "agentic",
  " agent ",
  "agents",
  "mcp",
  "model context protocol",
  "slash command",
  "subagent",
  "sub-agent",
  "tool use",
  "tool-calling",
  "function calling",
  "sdk",
  "vscode",
  "vs code",
  "jetbrains",
  "neovim",
  "developer tool",
  "developer-tools",
  "dev tool",
  "scaffold",
  "boilerplate",
  "workflow automation",
  "agent framework",
  "autonomous agent",
] as const;

/**
 * Model-internals signals — the behind-the-scenes tech (training, inference
 * kernels, quantization, model architecture). Interesting, but not what this
 * community is here for; these get a ranking dampener.
 */
const MODEL_INTERNAL_SIGNALS = [
  "pretrain",
  "pre-train",
  "fine-tune",
  "fine-tuning",
  "finetune",
  "quantization",
  "quantize",
  "gguf",
  "cuda kernel",
  "triton kernel",
  "inference engine",
  "inference server",
  "serving engine",
  "kv cache",
  "attention mechanism",
  "flash attention",
  "transformer architecture",
  "diffusion model",
  "model architecture",
  "tokenizer",
  "training pipeline",
  "trainer",
  "distillation",
  "lora",
  "qlora",
  "peft",
  "vllm",
  "llama.cpp",
  "model weights",
  "checkpoint",
  "rlhf",
  " dpo ",
  "mixture of experts",
  " moe ",
  "gradient",
] as const;

/**
 * Ranking weight in favor of application-dev / coding-agent repos and against
 * model-internals repos. A *preference*, not a filter: it multiplies the
 * trending score, so a dramatically faster-rising repo can still win. Matches
 * title + description + README (padded so " agent "/" moe " match whole words).
 */
export function applicationAffinity(d: Discovered): number {
  const hay = ` ${[d.source.title ?? "", d.source.description ?? "", d.readme ?? ""]
    .join(" ")
    .toLowerCase()} `;
  const appDev = APP_DEV_SIGNALS.some((s) => hay.includes(s));
  const modelInternals = MODEL_INTERNAL_SIGNALS.some((s) => hay.includes(s));
  // Mixed signals (e.g. an MCP server for fine-tuning) cancel out to neutral.
  if (appDev && modelInternals) return 1;
  if (appDev) return 1.6;
  if (modelInternals) return 0.55;
  return 1;
}

/**
 * Rank candidates by trending score, weighted by application affinity,
 * descending. Pure — never mutates input.
 */
export function rankCandidates(candidates: Discovered[], now: Date): Discovered[] {
  const score = (d: Discovered) => trendingScore(d.source, now) * applicationAffinity(d);
  return [...candidates].sort((a, b) => score(b) - score(a));
}
