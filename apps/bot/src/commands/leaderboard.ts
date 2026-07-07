import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { DigestItem, InternalClient } from "../client";
import { buildLeaderboardEmbed } from "../embeds";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 10;

export const leaderboardCommand = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Top AIx evaluations from the last 30 days");

/**
 * There is no dedicated ranking endpoint, so we reuse the digest endpoint over a
 * wide window and rank locally by overallScore, keeping the top `limit`.
 */
export async function fetchLeaderboard(
  client: InternalClient,
  opts?: { now?: number; lookbackMs?: number; limit?: number },
): Promise<DigestItem[]> {
  const now = opts?.now ?? Date.now();
  const since = new Date(now - (opts?.lookbackMs ?? THIRTY_DAYS_MS)).toISOString();
  const items = await client.fetchDigest(since);
  return [...items]
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, opts?.limit ?? DEFAULT_LIMIT);
}

export async function handleLeaderboard(
  interaction: ChatInputCommandInteraction,
  client: InternalClient,
): Promise<void> {
  await interaction.deferReply();
  try {
    const items = await fetchLeaderboard(client);
    await interaction.editReply({ embeds: [buildLeaderboardEmbed(items)] });
  } catch (err) {
    console.error("[/leaderboard] failed:", err);
    await interaction.editReply("Couldn't reach the evaluation service right now.");
  }
}
