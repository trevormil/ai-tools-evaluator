import { NextResponse } from "next/server";
import { dumpItems, type DumpCursor } from "@/lib/queries";
import { toDumpItem } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** `createdAt:id` → opaque base64url cursor, and back. */
function encodeCursor(c: DumpCursor): string {
  return Buffer.from(`${c.createdAt}:${c.id}`, "utf8").toString("base64url");
}
function decodeCursor(raw: string): DumpCursor {
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  const sep = decoded.indexOf(":");
  const createdAt = Number(decoded.slice(0, sep));
  const id = decoded.slice(sep + 1);
  if (sep < 0 || !id || !Number.isInteger(createdAt)) {
    throw new Error("malformed cursor");
  }
  return { createdAt, id };
}

/**
 * Public, read-only bulk dump of the whole corpus — every published, scored
 * item with its official evaluation, README, and metadata. Cursor-paginated:
 * follow `nextCursor` until it is null. `?kind=` narrows to one kind
 * (github_repo | arxiv_paper | external_link); `?limit=` caps the page (≤100).
 */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;

  const limitRaw = Number(q.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  let cursor: DumpCursor | undefined;
  const cursorRaw = q.get("cursor");
  if (cursorRaw) {
    try {
      cursor = decodeCursor(cursorRaw);
    } catch {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400, headers: CORS });
    }
  }

  const { items, nextCursor } = dumpItems({ limit, cursor, kind: q.get("kind") ?? undefined });

  return NextResponse.json(
    {
      items: items.map(toDumpItem),
      count: items.length,
      nextCursor: nextCursor ? encodeCursor(nextCursor) : null,
    },
    {
      headers: {
        ...CORS,
        "cache-control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}
