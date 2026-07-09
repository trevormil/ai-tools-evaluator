# AIx — Kubernetes deploy runbook

Deploys AIx to the cluster serving `aix.trevormil.com`. Three workloads in the
`aix` namespace:

| Workload | Kind | Image | Notes |
| --- | --- | --- | --- |
| `aix-web` | Deployment (replicas: 1) | `ghcr.io/trevormil/aix-web` | Owns SQLite on the RWO PVC; runs migrations at boot; serves :3000. |
| `aix-scanner` | CronJob (daily 14:00 UTC) | `ghcr.io/trevormil/aix-scanner` | Runs the pipeline once, calls web's internal API. |
| `aix-bot` | Deployment (replicas: 1) | `ghcr.io/trevormil/aix-bot` | Long-running Discord bot. |

**Single-writer rule:** only `aix-web` (one replica) mounts the `aix-db` PVC and
touches the SQLite file. Scanner and bot never open the DB — they call
`/api/internal/*` on `http://aix-web.aix.svc.cluster.local` with the shared
`AIX_INTERNAL_TOKEN`.

## Prerequisites (in the cluster, once)

- nginx ingress controller and cert-manager with a `letsencrypt-prod`
  ClusterIssuer (shared cluster infra).
- A `StorageClass` that provisions `ReadWriteOnce` volumes (the default).

## 1. Build & push images

Handled automatically by `.github/workflows/build-images.yml` on every push to
`main` (tags each image `latest` + the commit SHA). To build/push manually:

```sh
# from the repo root
echo "$GHCR_PAT" | docker login ghcr.io -u trevormil --password-stdin
for app in web scanner bot; do
  docker build -f Dockerfile.$app -t ghcr.io/trevormil/aix-$app:latest .
  docker push ghcr.io/trevormil/aix-$app:latest
done
```

## 2. Namespace + app secret (out-of-band, never committed)

The GHCR images (`ghcr.io/trevormil/aix-*`) are **public**, so the manifests pull
them anonymously and no `imagePullSecret` is required. If you make the packages
private, add a `ghcr-pull` docker-registry secret and re-add `imagePullSecrets:
[{name: ghcr-pull}]` to each workload:

```sh
kubectl -n aix create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io --docker-username=trevormil --docker-password="$GHCR_PAT"
```

```sh
kubectl apply -f k8s/namespace.yaml

# App secret. Fill a copy of k8s/secret.example.yaml (keep it OUT of git), or:
kubectl -n aix create secret generic aix-secrets \
  --from-literal=ANTHROPIC_API_KEY=... \
  --from-literal=GITHUB_TOKEN=... \
  --from-literal=AIX_INTERNAL_TOKEN=... \
  --from-literal=GITHUB_OAUTH_CLIENT_ID=... \
  --from-literal=GITHUB_OAUTH_CLIENT_SECRET=... \
  --from-literal=DISCORD_TOKEN=... \
  --from-literal=DISCORD_APP_ID=... \
  --from-literal=DISCORD_DIGEST_CHANNEL_ID=...
```

## 3. Apply the manifests

```sh
kubectl apply -k k8s/
# preview first:  kubectl apply -k k8s/ --dry-run=client
```

## 4. DNS

Point `aix.trevormil.com` (A/AAAA or CNAME) at the ingress controller's
external IP/hostname. cert-manager issues the `aix-trevormil-tls` cert via the
`letsencrypt-prod` issuer once DNS resolves.

## 5. Verify

```sh
kubectl -n aix get pods,svc,ingress,pvc,cronjob
kubectl -n aix logs deploy/aix-web         # expect "migrations applied" then Next boot
curl -I https://aix.trevormil.com
kubectl -n aix create job --from=cronjob/aix-scanner aix-scanner-manual  # test a scan run
```

## What a human must do

- Create the `aix-secrets` secret (step 2). No pull secret is needed while the
  GHCR packages stay public.
- Point DNS for `aix.trevormil.com` at the ingress (step 4).
- Run the final `kubectl apply -k k8s/` (deploy is human-gated; CI only builds).
