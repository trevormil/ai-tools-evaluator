import { REST, Routes } from "discord.js";
import type { Env } from "../env";
import { submitCommand } from "./submit";
import { scoreCommand } from "./score";
import { evalCommand } from "./eval";
import { leaderboardCommand } from "./leaderboard";

export * from "./submit";
export * from "./score";
export * from "./eval";
export * from "./leaderboard";

/** All slash commands the bot exposes. */
export const commands = [submitCommand, scoreCommand, evalCommand, leaderboardCommand];

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
