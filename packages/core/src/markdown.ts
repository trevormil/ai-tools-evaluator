import { Evaluation } from "./schema";
import { METRICS } from "./metrics";
import { CATEGORY_LABELS } from "./categories";
import { PRIMARY_AUDIENCE_LABELS } from "./audience";
import { LENS_SECTIONS, lensFor } from "./lenses";

/**
 * Serialize an Evaluation to a strict git-native `.md` artifact. The document is
 * human-readable (frontmatter + fixed section order + a scorecard table) AND
 * machine round-trippable: the full canonical object is embedded in a fenced
 * ```json block at the end, so `parseArtifact` never has to guess.
 */
export function toMarkdown(e: Evaluation): string {
  const fm = [
    "---",
    `slug: ${e.slug}`,
    `title: ${JSON.stringify(e.source.title)}`,
    `kind: ${e.source.kind}`,
    `category: ${e.category}`,
    `integration: ${e.integration}`,
    `verdict: ${e.verdict}`,
    `overall_score: ${e.overallScore}`,
    `noise_score: ${e.noiseScore}`,
    `tags: [${e.tags.join(", ")}]`,
    `source_url: ${e.source.url}`,
    `evaluated_by: ${e.evaluatedBy}`,
    `evaluated_at: ${e.evaluatedAt}`,
    e.model ? `model: ${e.model}` : null,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const scoreTable = [
    "| Metric | Score | Why |",
    "| --- | ---: | --- |",
    ...METRICS.map((m) => {
      const s = e.scores[m.key];
      return `| ${m.label} | **${s.score}** | ${s.rationale.replace(/\|/g, "\\|")} |`;
    }),
    `| **Overall** | **${e.overallScore}** | Weighted final score |`,
  ].join("\n");

  const media = e.media.length
    ? "\n## Media\n\n" +
      e.media
        .map((m) =>
          m.type === "image"
            ? `![${m.alt ?? e.source.title}](${m.cachedUrl ?? m.url})`
            : `[▶ video](${m.cachedUrl ?? m.url})`,
        )
        .join("\n\n")
    : "";

  // Render the write-up sections for this item's lens, in order, skipping any
  // optional section the evaluator didn't produce.
  const bodyMd = LENS_SECTIONS[lensFor(e.source)]
    .map((s) => {
      const content = e.body[s.key];
      return content ? `## ${s.title}\n\n${content}` : null;
    })
    .filter(Boolean)
    .join("\n\n");

  return `${fm}

# ${e.source.title}

> **${e.verdict.toUpperCase()}** · ${CATEGORY_LABELS[e.category]} · ${e.integration} · overall **${e.overallScore}/100**

_${e.tagline}_

${bodyMd}

## Who it's for

**Primary: ${PRIMARY_AUDIENCE_LABELS[e.audience.primary]}** · AI-first engineer fit **${e.audience.aiEngineerFit}/100** · vibe-coder fit **${e.audience.vibeCoderFit}/100**

${e.audience.rationale}

## Scorecard

${scoreTable}
${media}

<!-- canonical: do not edit by hand -->
\`\`\`json
${JSON.stringify(e, null, 2)}
\`\`\`
`;
}

/** Recover the canonical Evaluation from a `.md` artifact produced above. */
export function parseArtifact(md: string): Evaluation {
  const match = md.match(/```json\n([\s\S]*?)\n```\s*$/);
  if (!match) throw new Error("no canonical json block found in artifact");
  return Evaluation.parse(JSON.parse(match[1]!));
}
