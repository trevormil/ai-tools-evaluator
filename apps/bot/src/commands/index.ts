import { REST, Routes } from "discord.js";
import type { Env } from "../env";
import { submitCommand } from "./submit";
import { evalCommand } from "./eval";

export * from "./submit";
export * from "./eval";

/** All slash commands the bot exposes. */
export const commands = [submitCommand, evalCommand];

/**
 * Register commands with Discord. Guild-scoped (instant) when DISCORD_GUILD_ID
 * is set — handy for dev — otherwise global (propagates in ~1h).
 */
export async function registerCommands(env: Env): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  const body = commands.map((c) => c.toJSON());
  const route = env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_APP_ID, env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(env.DISCORD_APP_ID);
  await rest.put(route, { body });
}
