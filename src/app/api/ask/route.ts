import { z } from "zod";
import { ask } from "@/lib/ai/answer";
import { PRODUCTS } from "@/config/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  question: z.string().trim().min(3).max(1000),
  productId: z.enum(PRODUCTS.map((p) => p.id) as [string, ...string[]]).nullable().optional(),
  sources: z.array(z.enum(["learn", "techcommunity", "reddit"])).min(1).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { question, productId = null, sources = ["learn", "techcommunity", "reddit"] } = parsed.data;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of ask(question, { productId, sources })) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch (err) {
        const text = err instanceof Error ? err.message : "Unexpected error";
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "notice", text })}\n${JSON.stringify({ type: "done" })}\n`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
