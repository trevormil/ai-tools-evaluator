/**
 * Next.js instrumentation hook — runs once when the server process boots (not at
 * build time, not in the browser). We use it to apply DB migrations so the schema
 * is ready before the first request. Guarded to the Node/Bun server runtime.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("./lib/migrate");
  try {
    runMigrations();
    // eslint-disable-next-line no-console
    console.log("[aix/web] migrations applied");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[aix/web] migration failure", err);
    throw err;
  }
}
