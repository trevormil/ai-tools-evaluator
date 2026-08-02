/**
 * Coerce a raw LLM evaluation draft to satisfy the strict schema's easy-to-miss
 * bounds BEFORE validation, so a cheap model's minor formatting slips — an empty
 * or too-short tag, an over-length tagline/insteadOf — don't hard-fail the whole
 * evaluation after the repair retries are exhausted (ticket 0055). It only
 * clamps/cleans existing content; it never invents fields or values. Anything it
 * can't safely fix is left for the schema to reject as before.
 */
export function sanitizeEvaluationDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;

  // tags: kebab-case slugs, 2–80 chars, unique, max 12 — drop/repair the junk
  // (empty strings, 1-char, punctuation) the model sometimes emits.
  if (Array.isArray(o.tags)) o.tags = cleanTags(o.tags);

  // tagline: hard cap at 160 (the most common overflow). Cut at a sentence
  // boundary when one exists so the result stays a complete sentence (0076);
  // otherwise word-cut and let the schema reject it into the repair loop.
  if (typeof o.tagline === "string") o.tagline = clampSentence(o.tagline, 160);

  const q = o.quickstart;
  if (q && typeof q === "object") {
    const qq = q as Record<string, unknown>;
    // install must be one line ≤200.
    if (typeof qq.install === "string") qq.install = qq.install.split("\n")[0]!.slice(0, 200);
    if (Array.isArray(qq.requires)) {
      qq.requires = qq.requires
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.slice(0, 80))
        .slice(0, 6);
    }
  }

  const d = o.decision;
  if (d && typeof d === "object") {
    const dd = d as Record<string, unknown>;
    if (typeof dd.insteadOf === "string") dd.insteadOf = dd.insteadOf.slice(0, 120);
    for (const k of ["adoptIf", "skipIf"] as const) {
      if (Array.isArray(dd[k])) {
        dd[k] = (dd[k] as unknown[])
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.slice(0, 140))
          .slice(0, 4);
      }
    }
  }

  return o;
}

function cleanTags(tags: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const slug = t
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug.length < 2 || slug.length > 80 || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= 12) break;
  }
  return out;
}

/** Truncate to `max`, preferring the last sentence end (. ! ?) inside the cap;
 *  falls back to a word cut when the text has no usable sentence boundary. */
function clampSentence(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = cut.match(/^[\s\S]*[.!?](?=["')\]]?)/);
  if (sentence && sentence[0].length > max * 0.3) {
    const end = cut.slice(0, sentence[0].length + 1);
    return /["')\]]$/.test(end) ? end : sentence[0];
  }
  const sp = cut.lastIndexOf(" ");
  return sp > max * 0.6 ? cut.slice(0, sp) : cut;
}
