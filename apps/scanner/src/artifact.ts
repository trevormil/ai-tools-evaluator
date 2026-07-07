import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { toMarkdown, type Evaluation } from "@aix/core";

/**
 * Export a published Evaluation as its strict `.md` artifact for the git-native
 * archive. Uses `@aix/core`'s `toMarkdown` (round-trippable canonical JSON block).
 * Default target is the repo-root `content/items/` directory.
 */

/** repo-root `content/items` — this file lives at apps/scanner/src/. */
export function defaultContentDir(): string {
  return resolve(import.meta.dir, "../../../content/items");
}

export async function writeArtifact(
  evaluation: Evaluation,
  dir: string = defaultContentDir(),
): Promise<string> {
  const path = resolve(dir, `${evaluation.slug}.md`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, toMarkdown(evaluation), "utf8");
  return path;
}
