import type { Item } from "@aix/db";

/**
 * The repo's own README, shown alongside our evaluation so users can explore
 * what the project says about itself — not just our verdict.
 *
 * The corpus (ADR-0004) doesn't store READMEs, so GitHub items lazy-fetch from
 * raw.githubusercontent (best-effort, at render/build time). No DB cache.
 */

export const READMES_MAX_CHARS = 80_000;
const FETCH_TIMEOUT_MS = 3_500;

const rawBase = (externalId: string) => `https://raw.githubusercontent.com/${externalId}/HEAD`;
const blobBase = (externalId: string) => `https://github.com/${externalId}/blob/HEAD`;

function isRelative(target: string): boolean {
  return (
    !/^[a-z][a-z0-9+.-]*:/i.test(target) && // no scheme (https:, mailto:, …)
    !target.startsWith("//") && // protocol-relative
    !target.startsWith("#") // in-page anchor
  );
}

/**
 * Make a real-world README renderable under the safe html:false renderer:
 * keep raw <img> tags as markdown images, drop other raw HTML tags (keeping
 * their inner text), and absolutize relative links/images against the repo.
 */
export function prepareReadme(md: string, externalId: string): string {
  let out = md.slice(0, READMES_MAX_CHARS);

  // 1) Raw <img> → markdown image (badges + hero shots are the common case).
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src) return "";
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    return `![${alt}](${src})`;
  });

  // 2) Drop remaining raw HTML tags; their text content stays.
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  // 3) Absolutize relative markdown targets: images → raw, links → blob.
  out = out.replace(
    /(!?)\[([^\]]*)\]\(\s*([^)\s]+)(\s+"[^"]*")?\s*\)/g,
    (whole, bang: string, text: string, target: string, title = "") => {
      if (!isRelative(target)) return whole;
      const clean = target.replace(/^\.\//, "");
      const base = bang === "!" ? rawBase(externalId) : blobBase(externalId);
      return `${bang}[${text}](${base}/${clean}${title})`;
    },
  );

  return out;
}

/** Fetch the default-branch README from raw.githubusercontent (no API quota). */
export async function fetchRepoReadme(externalId: string): Promise<string | null> {
  for (const name of ["README.md", "readme.md", "Readme.md"]) {
    try {
      const res = await fetch(`${rawBase(externalId)}/${name}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: "text/plain" },
      });
      if (res.ok) return (await res.text()).slice(0, READMES_MAX_CHARS);
      if (res.status !== 404) return null; // rate-limited/etc — retry another day
    } catch {
      return null; // network/timeout — don't mark as absent
    }
  }
  return ""; // definitively absent
}

/**
 * The README for an item: a stored copy if present, else a lazy fetch for
 * GitHub repos. Returns null when there is nothing to show.
 */
export async function getOrFetchReadme(item: Item): Promise<string | null> {
  if (item.readmeMd != null) return item.readmeMd === "" ? null : item.readmeMd;
  if (item.kind !== "github_repo") return null;

  const fetched = await fetchRepoReadme(item.externalId);
  return fetched ? fetched : null;
}
