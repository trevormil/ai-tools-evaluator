/**
 * One-time DigitalOcean Spaces bootstrap: create the media bucket + permissive
 * CORS. Run ONCE with FULLACCESS Spaces creds in `.env` (a scoped key can't be
 * minted until the bucket exists — DO returns "invalid grant"):
 *
 *   bun scripts/spaces-setup.ts
 *
 * After this, the app only needs read/write on the bucket. Uploads set
 * per-object public-read ACLs, so no bucket policy is required.
 */
import { AwsClient } from "aws4fetch";

const {
  AIX_SPACES_ENDPOINT: endpoint,
  AIX_SPACES_REGION: region,
  AIX_SPACES_BUCKET: bucket,
  AIX_SPACES_KEY: accessKeyId,
  AIX_SPACES_SECRET: secretAccessKey,
} = process.env;

if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
  console.error("Missing AIX_SPACES_* env. Put FULLACCESS Spaces creds in .env first.");
  process.exit(1);
}

const aws = new AwsClient({ accessKeyId, secretAccessKey, region, service: "s3" });
const bucketUrl = `${endpoint!.replace(/\/$/, "")}/${bucket}`;

const CORS = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

async function main() {
  // Create bucket (idempotent-ish: 409 BucketAlreadyOwnedByYou is fine).
  const create = await aws.fetch(bucketUrl, { method: "PUT" });
  if (create.ok) console.log(`✓ bucket created: ${bucket}`);
  else if (create.status === 409) console.log(`✓ bucket already exists: ${bucket}`);
  else {
    console.error(`bucket create failed ${create.status}: ${await create.text()}`);
    process.exit(1);
  }

  // Apply CORS.
  const cors = await aws.fetch(`${bucketUrl}?cors`, { method: "PUT", body: CORS, headers: { "content-type": "application/xml" } });
  console.log(cors.ok ? "✓ CORS applied" : `CORS failed ${cors.status}: ${await cors.text()}`);

  console.log(`\nMedia base URL: https://${bucket}.${region}.cdn.digitaloceanspaces.com`);
  console.log("Done. The app can now upload via AIX_SPACES_* env.");
}

main();
