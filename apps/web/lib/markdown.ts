import MarkdownIt from "markdown-it";

/**
 * The ONE renderer for all user-authored long-form content (articles + workflow
 * bodies). Configured SAFE: `html: false` drops any raw HTML the user typed (so
 * `<script>` / `<img onerror=…>` become inert text, never live nodes), and
 * markdown-it's own link validator rejects `javascript:` / `vbscript:` / most
 * `data:` URLs by default. Output is therefore safe to hand to
 * `dangerouslySetInnerHTML`.
 */
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

export function renderMarkdown(input: string): string {
  return md.render(input ?? "");
}

/**
 * Tailwind arbitrary-variant classes that re-apply typographic spacing to
 * rendered markdown (preflight strips element defaults; no prose plugin here —
 * the design agent owns tailwind.config). Shared by the server renderer and the
 * editor's client-side live preview so they look identical.
 */
export const MARKDOWN_CLASSES = [
  "text-[0.95rem] leading-relaxed",
  "[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold",
  "[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold",
  "[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold",
  "[&_p]:mb-4",
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:mb-1",
  "[&_a]:font-medium [&_a]:underline [&_a]:decoration-neutral-400 hover:[&_a]:decoration-current",
  "[&_blockquote]:mb-4 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-4 [&_blockquote]:text-neutral-600 dark:[&_blockquote]:border-neutral-700 dark:[&_blockquote]:text-neutral-400",
  "[&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] dark:[&_code]:bg-neutral-800",
  "[&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-100 [&_pre]:p-3 dark:[&_pre]:bg-neutral-900",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg",
  "[&_hr]:my-6 [&_hr]:border-neutral-200 dark:[&_hr]:border-neutral-800",
].join(" ");
