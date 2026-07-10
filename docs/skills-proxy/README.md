# skills.sh proxy (deploy on Vercel)

The AIx scanner runs on DOKS and can't mint the Vercel OIDC token that
`skills.sh/api/v1` requires. This tiny Vercel Function mints OIDC on Vercel's
side and forwards to skills.sh, guarded by a shared secret the scanner sends.

## Deploy

1. New (or existing) Vercel project. Copy `api/skills.ts` into it and add the dep:
   ```
   npm i @vercel/oidc
   ```
2. **Enable OIDC** for the project: Vercel dashboard → Settings → **OIDC Federation** → enable.
3. Set an env var **`SKILLS_PROXY_SECRET`** to a long random string (this is the
   shared secret the scanner will send).
4. `vercel deploy --prod`.

## Give AIx the values

Put these in the `aix-secrets` k8s secret (the scanner reads them via `envFrom`):

```
kubectl -n aix patch secret aix-secrets --type merge -p '{"stringData":{
  "SKILLS_PROXY_URL":"https://<your-project>.vercel.app/api/skills",
  "SKILLS_PROXY_TOKEN":"<the SKILLS_PROXY_SECRET value>"
}}'
```

When both are present, the daily scan adds **3 trending skills** to the 5 GitHub +
5 ProductHunt mix (evaluated through the agent-tool lens). Absent → skills are
skipped, no failure.

## Verify

```
curl -s -H "Authorization: Bearer <secret>" "https://<project>.vercel.app/api/skills?view=trending&per_page=3" | head
```
Should return the skills.sh trending JSON (not a 401).
