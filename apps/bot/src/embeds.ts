import { EmbedBuilder } from "discord.js";
import { CATEGORY_LABELS, type Category } from "@aix/core";
import type { DigestItem } from "./client";

/** Verdict → accent color, brightest (essential) to darkest (complexity-trap). */
const VERDICT_COLORS: Record<string, number> = {
  essential: 0x2ecc71,
  worthwhile: 0x27ae60,
  niche: 0xf1c40f,
  marginal: 0xe67e22,
  redundant: 0xe74c3c,
  "complexity-trap": 0xc0392b,
};

const titleCase = (s: string) =>
  s.replace(/(^|-)([a-z])/g, (_, sep, ch: string) => (sep ? " " : "") + ch.toUpperCase());

/** Rich embed for a single evaluated item — used by both /eval and the digest. */
export function buildItemEmbed(item: DigestItem): EmbedBuilder {
  const categoryLabel = CATEGORY_LABELS[item.category as Category] ?? item.category;
  const embed = new EmbedBuilder()
    .setTitle(item.title)
    .setURL(item.url)
    .setDescription(item.tagline)
    .setColor(VERDICT_COLORS[item.verdict] ?? 0x95a5a6)
    .addFields(
      { name: "Verdict", value: titleCase(item.verdict), inline: true },
      { name: "Overall", value: `${item.overallScore}/100`, inline: true },
      { name: "Category", value: categoryLabel, inline: true },
    );
  if (item.coverImageUrl) embed.setImage(item.coverImageUrl);
  return embed;
}

/** Compact single-embed leaderboard: one ranked line per item. */
export function buildLeaderboardEmbed(items: DigestItem[]): EmbedBuilder {
  const lines = items.map((item, i) => {
    const categoryLabel = CATEGORY_LABELS[item.category as Category] ?? item.category;
    return `**${i + 1}.** [${item.title}](${item.url}) — ${item.overallScore}/100 · ${titleCase(
      item.verdict,
    )} · ${categoryLabel}`;
  });
  return new EmbedBuilder()
    .setTitle("🏅 AIx leaderboard")
    .setColor(0x2ecc71)
    .setDescription(lines.length ? lines.join("\n") : "No recent evaluations yet.");
}
