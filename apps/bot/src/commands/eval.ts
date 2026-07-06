import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DigestItem, InternalClient } from "../client";
import { buildItemEmbed } from "../embeds";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const evalCommand = new SlashCommandBuilder()
  .setName("eval")
  .setDescription("Look up a recent AIx evaluation")
  .addStringOption((o) =>
    o.setName("query").setDescription("Name or keyword to search for").setRequired(true),
  );

/** Pick the best match for a free-text query: exact slug/title first, then substring. */
export function matchItem(items: DigestItem[], query: string): DigestItem | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const exact = items.find((i) => i.slug === q || i.title.toLowerCase() === q);
  if (exact) return exact;
  return (
    items.find(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.slug.includes(q) ||
        i.tagline.toLowerCase().includes(q),
    ) ?? null
  );
}

/**
 * There is no dedicated single-item lookup endpoint, so we reuse the digest
 * endpoint over a wide window and filter locally. Assumption documented in the
 * bot README / ticket 0012 summary.
 */
export async function lookupEval(
  client: InternalClient,
  query: string,
  opts?: { now?: number; lookbackMs?: number },
): Promise<DigestItem | null> {
  const now = opts?.now ?? Date.now();
  const since = new Date(now - (opts?.lookbackMs ?? NINETY_DAYS_MS)).toISOString();
  const items = await client.fetchDigest(since);
  return matchItem(items, query);
}

export async function handleEval(
  interaction: ChatInputCommandInteraction,
  client: InternalClient,
): Promise<void> {
  const query = interaction.options.getString("query", true);
  await interaction.deferReply();
  try {
    const item = await lookupEval(client, query);
    if (!item) {
      await interaction.editReply(`No recent evaluation found for “${query}”.`);
      return;
    }
    await interaction.editReply({ embeds: [buildItemEmbed(item)] });
  } catch (err) {
    console.error("[/eval] failed:", err);
    await interaction.editReply("Couldn't reach the evaluation service right now.");
  }
}
