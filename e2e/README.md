# AIx e2e (Playwright)

Browser e2e against a real, seeded build of the web app.

```bash
cd e2e
bun install
bun run install-browser   # one-time: downloads chromium
bun run test              # builds apps/web, seeds a temp DB, runs the suite
```

`global-setup.ts` migrates + seeds a throwaway SQLite DB (`/tmp/aix-e2e-pw.db`)
and creates a deterministic test user + session (`e2euser` / cookie `e2e-token`)
for authed flows. `playwright.config.ts` builds + starts the app on :3222.
