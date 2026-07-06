/**
 * Turn an external id ("owner/repo", "2401.12345") into a schema-valid slug:
 * kebab-case, `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 2–80 chars. Deterministic so a given
 * item always maps to the same slug (idempotent publishes).
 */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base.length >= 2 ? base : `item-${base || "x"}`;
}
