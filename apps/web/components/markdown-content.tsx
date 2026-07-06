import { renderMarkdown, MARKDOWN_CLASSES } from "@/lib/markdown";

/**
 * Renders trusted-safe markdown HTML (see lib/markdown — html:false, so the
 * `dangerouslySetInnerHTML` below can never inject live script/handlers).
 */
export function MarkdownContent({ md }: { md: string }) {
  return <div className={MARKDOWN_CLASSES} dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} />;
}
