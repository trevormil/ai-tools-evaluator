// @ts-expect-error - S3Client is a bun 1.3 runtime export not yet in @types/bun 1.1
import { S3Client } from "bun";
import { z } from "zod";

/**
 * Object storage on DigitalOcean Spaces (S3-compatible), via bun's native S3
 * client. Configured entirely by env; when unconfigured, `isStorageConfigured`
 * is false and callers should reject uploads with a clear message rather than
 * crash. Uploaded objects are public-read and served from the CDN base URL.
 */
const StorageEnv = z.object({
  AIX_SPACES_ENDPOINT: z.string().url(),
  AIX_SPACES_REGION: z.string(),
  AIX_SPACES_BUCKET: z.string(),
  AIX_SPACES_KEY: z.string(),
  AIX_SPACES_SECRET: z.string(),
  AIX_MEDIA_BASE_URL: z.string().url(),
});

export function isStorageConfigured(): boolean {
  return StorageEnv.safeParse(process.env).success;
}

function client() {
  const env = StorageEnv.parse(process.env);
  return {
    s3: new S3Client({
      endpoint: env.AIX_SPACES_ENDPOINT,
      region: env.AIX_SPACES_REGION,
      bucket: env.AIX_SPACES_BUCKET,
      accessKeyId: env.AIX_SPACES_KEY,
      secretAccessKey: env.AIX_SPACES_SECRET,
    }),
    base: env.AIX_MEDIA_BASE_URL.replace(/\/$/, ""),
  };
}

const ALLOWED = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upload image bytes under `prefix/` and return the public CDN URL. Validates
 * content-type + size. `keyHint` seeds a deterministic-ish name; a random
 * suffix avoids collisions/caching issues.
 */
export async function uploadImage(
  prefix: string,
  bytes: ArrayBuffer | Uint8Array,
  contentType: string,
  keyHint = "img",
): Promise<string> {
  if (!isStorageConfigured()) throw new Error("Object storage is not configured (AIX_SPACES_* env unset).");
  const ext = ALLOWED.get(contentType);
  if (!ext) throw new Error(`Unsupported image type: ${contentType}`);
  const size = bytes instanceof Uint8Array ? bytes.byteLength : bytes.byteLength;
  if (size > MAX_UPLOAD_BYTES) throw new Error("Image too large (max 5 MB).");

  const safeHint = keyHint.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "img";
  const rand = crypto.randomUUID().slice(0, 8);
  const key = `${prefix}/${safeHint}-${rand}.${ext}`;

  const { s3, base } = client();
  await s3.file(key).write(bytes, { type: contentType, acl: "public-read" });
  return `${base}/${key}`;
}
