import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Unauthorized } from "./auth";

/** Map thrown errors from a route handler to a JSON HTTP response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof Unauthorized) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", details: err.flatten() }, { status: 400 });
  }
  // eslint-disable-next-line no-console
  console.error("[aix/web] route error", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
