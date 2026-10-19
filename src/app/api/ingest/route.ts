import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { ingestAll } from "@/lib/ingest/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const token = env.ingestToken;
  if (!token) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { productIds?: string[] };
  const summaries = await ingestAll(Array.isArray(body.productIds) ? body.productIds : undefined);
  return Response.json({ summaries });
}
