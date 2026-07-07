import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { InternalClient } from "../client";

export const submitCommand = new SlashCommandBuilder()
  .setName("submit")
  .setDescription("Submit a link to the AIx suggestion queue")
  .addStringOption((o) =>
    o.setName("url").setDescription("Link to the tool, repo, or paper").setRequired(true),
  )
  .addStringOption((o) =>
    o
      .setName("note")
      .setDescription("Optional context on why it's worth a look")
      .setRequired(false),
  );

export async function handleSubmit(
  interaction: ChatInputCommandInteraction,
  client: InternalClient,
): Promise<void> {
  const url = interaction.options.getString("url", true);
  const note = interaction.options.getString("note") ?? undefined;

  await interaction.deferReply({ ephemeral: true });
  try {
    const result = await client.enqueueSubmission({
      url,
      note,
      discordUserId: interaction.user.id,
    });
    await interaction.editReply(
      result.duplicate
        ? `Already in the queue — thanks though!\n${url}`
        : `Queued for evaluation.\n${url}`,
    );
  } catch (err) {
    console.error("[/submit] failed:", err);
    await interaction.editReply("Couldn't reach the queue right now. Try again in a bit.");
  }
}
