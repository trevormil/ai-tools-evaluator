import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { validateGithubRepoUrl } from "@aix/core";
import type { InternalClient } from "../client";

export const scoreCommand = new SlashCommandBuilder()
  .setName("score")
  .setDescription("Score a GitHub repo — drops it in the queue, evaluated within ~5 minutes")
  .addStringOption((o) =>
    o
      .setName("url")
      .setDescription("GitHub repo URL, e.g. https://github.com/owner/repo")
      .setRequired(true),
  );

/** No sign-in needed — anyone in the server can score a repo. */
export async function handleScore(
  interaction: ChatInputCommandInteraction,
  client: InternalClient,
  siteBaseUrl: string,
): Promise<void> {
  const url = interaction.options.getString("url", true).trim();
  await interaction.deferReply();

  const check = validateGithubRepoUrl(url);
  if (!check.ok) {
    await interaction.editReply(`🚫 ${check.reason}`);
    return;
  }

  try {
    const result = await client.enqueueSubmission({ url, discordUserId: interaction.user.id });
    const base = siteBaseUrl.replace(/\/+$/, "");
    const link = result.item ? `${base}/item/${result.item.slug}` : url;
    const name = result.item?.title ?? url;
    await interaction.editReply(
      result.duplicate
        ? `Already in the catalog — **${name}**\n${link}`
        : `📥 Queued **${name}** — scored within ~5 minutes.\n${link}`,
    );
  } catch (err) {
    console.error("[/score] failed:", err);
    const reason = err instanceof Error ? err.message : "";
    await interaction.editReply(
      reason && !reason.includes("failed:")
        ? `🚫 ${reason}`
        : "Couldn't reach the queue right now — try again in a bit.",
    );
  }
}
