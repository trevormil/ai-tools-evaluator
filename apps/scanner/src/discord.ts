import type { Evaluation } from "@aix/core";

/**
 * Post the run's single featured pick to a Discord webhook: one short content
 * line plus one embed (title/link + verdict, score, tagline). Exactly ONE POST
 * per run. A webhook failure is logged and swallowed — a broken webhook must
 * never fail the scan (the corpus write already succeeded).
 */
export async function postDigest(webhookUrl: string, pick: Evaluation): Promise<void> {
  const body = {
    content: `New top pick: **${pick.source.title}** — ${pick.verdict} (${pick.overallScore}/100)`,
    embeds: [
      {
        title: pick.source.title,
        url: pick.source.url,
        description: `**${pick.verdict}** · ${pick.overallScore}/100\n${pick.tagline}`,
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`[scanner] discord webhook -> ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.warn(`[scanner] discord webhook failed: ${String(err)}`);
  }
}
