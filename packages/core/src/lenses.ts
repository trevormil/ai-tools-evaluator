import type { ItemKind } from "./categories";

/**
 * Evaluation lenses — the same strict Evaluation schema and ten-metric scorecard
 * are judged through a different frame depending on WHAT the item is. A Claude
 * skill or agent tool is judged against a capable base agent ("is this just
 * complexity?"); a launched product against its incumbents ("why not the tool
 * you already use?"); a paper against prior work ("does this move the field?").
 *
 * Only three things change per lens: the prompt framing, the baseline the
 * `deltaVsBaseline` metric is measured against, and which write-up sections are
 * required. The metric KEYS, verdict, audience, and DB/feed machinery stay
 * identical so the catalog stays filterable and comparable across types.
 */

export const LENSES = ["agent-tool", "product", "research"] as const;
export type Lens = (typeof LENSES)[number];

/**
 * Default lens for an item kind. The scanner may override per item (an optional
 * `ItemSource.lens`) — e.g. a GitHub repo that is really a product — but absent
 * an override this is the frame. Falls back to `product` for unknown kinds.
 */
export const KIND_LENS: Record<ItemKind, Lens> = {
  github_repo: "agent-tool",
  arxiv_paper: "research",
  external_link: "product",
  producthunt: "product",
  // A Claude/agent skill IS an agent tool — judged against a base agent.
  skill: "agent-tool",
};

/** Resolve the lens for a source: explicit override, else by kind, else product. */
export function lensFor(source: { kind: string; lens?: Lens | null }): Lens {
  if (source.lens && LENSES.includes(source.lens)) return source.lens;
  return KIND_LENS[source.kind as ItemKind] ?? "product";
}

/** Every body write-up key across all lenses (drives the schema's body shape). */
export const BODY_SECTION_KEYS = [
  "whatItIs",
  "vsVanilla",
  "surfaceArea",
  "vsAlternatives",
  "vsPriorWork",
  "reproducibility",
  "devilsAdvocate",
  "whatWouldMakeItBetter",
  "steelman",
] as const;
export type BodySectionKey = (typeof BODY_SECTION_KEYS)[number];

export type SectionSpec = {
  key: BodySectionKey;
  /** Heading shown in the UI and the .md artifact. */
  title: string;
  /** Required for this lens (the evaluator must produce it; enforced in schema). */
  required: boolean;
  /** One-line instruction injected into the evaluator prompt. */
  prompt: string;
};

/** Sections common to every lens, in canonical order around the lens-specific ones. */
const WHAT_IT_IS: SectionSpec = {
  key: "whatItIs",
  title: "What it is",
  required: true,
  prompt: "whatItIs: plainspoken, no marketing — what the thing actually is and does.",
};
const WHAT_WOULD_MAKE_IT_BETTER: SectionSpec = {
  key: "whatWouldMakeItBetter",
  title: "What would make it better",
  required: true,
  prompt:
    "whatWouldMakeItBetter: forward-looking and specific — the concrete features, redesign, or change of direction that would move your verdict up. Name the actual gap, not vague praise.",
};
const STEELMAN: SectionSpec = {
  key: "steelman",
  title: "The honest case for it",
  required: false,
  prompt: "steelman (optional): when it genuinely IS worth it, the honest case for adoption.",
};

/**
 * Ordered sections per lens. The `agent-tool` list is byte-identical to the
 * original fixed sections (titles + order) so existing items render unchanged.
 */
export const LENS_SECTIONS: Record<Lens, SectionSpec[]> = {
  "agent-tool": [
    WHAT_IT_IS,
    {
      key: "vsVanilla",
      title: "How it differs from vanilla Claude",
      required: true,
      prompt:
        "vsVanilla: how it differs from a vanilla capable base agent (Claude) doing this unaided.",
    },
    {
      key: "surfaceArea",
      title: "Skill, plugin, or workflow shift?",
      required: true,
      prompt:
        "surfaceArea: justify the `integration` value — is it a skill, a plugin, or a shift in how you work?",
    },
    {
      key: "devilsAdvocate",
      title: "Devil's advocate — is this just complexity?",
      required: true,
      prompt:
        "devilsAdvocate: the point of the product. Argue specifically why a vanilla capable agent can already do this (or will soon), and whether it is complexity for complexity's sake. Be harsh.",
    },
    WHAT_WOULD_MAKE_IT_BETTER,
    STEELMAN,
  ],
  product: [
    WHAT_IT_IS,
    {
      key: "vsAlternatives",
      title: "How it compares to the alternatives",
      required: true,
      prompt:
        "vsAlternatives: how it compares to the incumbent tools and to doing it yourself — why reach for this over what you already use?",
    },
    {
      key: "devilsAdvocate",
      title: "Devil's advocate — do you actually need this?",
      required: true,
      prompt:
        "devilsAdvocate: the point of the product. Argue specifically why the reader does NOT need another product here — what already covers this, and whether it is a thin wrapper or genuine new value. Be harsh.",
    },
    WHAT_WOULD_MAKE_IT_BETTER,
    STEELMAN,
  ],
  research: [
    WHAT_IT_IS,
    {
      key: "vsPriorWork",
      title: "How it advances prior work",
      required: true,
      prompt:
        "vsPriorWork: what this establishes over prior work — the specific delta, not a restatement of the abstract.",
    },
    {
      key: "reproducibility",
      title: "Can you actually use it?",
      required: false,
      prompt:
        "reproducibility (optional): is there code/data to reproduce it, and could a practitioner apply it — or is it a result on paper only?",
    },
    {
      key: "devilsAdvocate",
      title: "Devil's advocate — does this matter?",
      required: true,
      prompt:
        "devilsAdvocate: the point of the product. Argue specifically why this may not matter in practice — narrow benchmark, unrealistic setup, or something a base model absorbs anyway. Be harsh.",
    },
    WHAT_WOULD_MAKE_IT_BETTER,
    STEELMAN,
  ],
};

/** The section keys the evaluator MUST produce for a lens (enforced in schema). */
export function requiredBodySections(lens: Lens): BodySectionKey[] {
  return LENS_SECTIONS[lens].filter((s) => s.required).map((s) => s.key);
}

export type LensDef = {
  label: string;
  /** What the whole evaluation (esp. `deltaVsBaseline`) is measured against. */
  baseline: string;
  /** Injected into the evaluator system prompt to set the frame. */
  framing: string;
  /** Catalog noun for the thing under this lens. */
  noun: string;
};

export const LENS_DEFS: Record<Lens, LensDef> = {
  "agent-tool": {
    label: "Agent tool",
    baseline: "a vanilla capable base agent (Claude) doing the task unaided",
    framing:
      "The dirty secret of this space is that most repos are thin optimizations over what a capable base agent (Claude) already does unaided — a prompt in a trench coat, a wrapper, or complexity for its own sake. The item must EARN a positive verdict with concrete capability a base agent plainly cannot reproduce.",
    noun: "tool",
  },
  product: {
    label: "Product",
    baseline: "the incumbent tools the reader already uses, and doing it yourself",
    framing:
      "Most launched products are a thinner-than-they-look layer over an incumbent or a weekend of glue code. The product must EARN a positive verdict with a concrete reason to switch that the reader can't cheaply get from what they already use.",
    noun: "product",
  },
  research: {
    label: "Research",
    baseline: "prior work in the same line, and what a base model already does",
    framing:
      "Most papers report a narrow delta on a favorable benchmark. The work must EARN a positive verdict with a result that changes what a practitioner would actually do, not just a leaderboard bump.",
    noun: "paper",
  },
};
