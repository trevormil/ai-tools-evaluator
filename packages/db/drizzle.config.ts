import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: { url: process.env.AIX_DB_PATH ?? "./aix.db" },
} satisfies Config;
