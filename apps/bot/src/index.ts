import { join } from "node:path";
import {
  Client,
  Events,
  GatewayIntentBits,
  type Interaction,
  type TextChannel,
} from "discord.js";
import { loadEnv } from "./env";
import { createInternalClient } from "./client";
import { registerCommands } from "./commands";
import { handleSubmit } from "./commands/submit";
import { handleEval } from "./commands/eval";
import { startDigestScheduler, type SendableChannel } from "./digest";

const STATE_PATH = join(import.meta.dir, "..", ".state.json");

async function main(): Promise<void> {
  const env = loadEnv();
  const api = createInternalClient({ baseUrl: env.AIX_WEB_URL, token: env.AIX_INTERNAL_TOKEN });

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (ready) => {
    console.log(`[bot] logged in as ${ready.user.tag}`);
    await registerCommands(env);
    startDigestScheduler({
      client: api,
      statePath: STATE_PATH,
      getChannel: async () => {
        const channel = await ready.channels.fetch(env.DISCORD_DIGEST_CHANNEL_ID);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`digest channel ${env.DISCORD_DIGEST_CHANNEL_ID} not a text channel`);
        }
        return channel as TextChannel as unknown as SendableChannel;
      },
    });
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "submit") await handleSubmit(interaction, api);
    else if (interaction.commandName === "eval") await handleEval(interaction, api);
  });

  await client.login(env.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error("[bot] fatal:", err);
  process.exit(1);
});
