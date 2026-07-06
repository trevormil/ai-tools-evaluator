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

## If `playwright install` hangs

This machine's `playwright install` can stall on the browser-download lock. If
`chromium_headless_shell-<rev>/chrome-mac/headless_shell` is missing, install it
directly (no lock):

```bash
rm -rf ~/Library/Caches/ms-playwright/__dirlock
REV=1148  # match `playwright --version` (1.49 → 1148)
curl -sSL -o /tmp/hs.zip \
  "https://cdn.playwright.dev/dbazure/download/playwright/builds/chromium/$REV/chromium-headless-shell-mac-arm64.zip"
DEST=~/Library/Caches/ms-playwright/chromium_headless_shell-$REV
rm -rf "$DEST" && mkdir -p "$DEST" && unzip -q /tmp/hs.zip -d "$DEST"
chmod +x "$DEST/chrome-mac/headless_shell"
```
