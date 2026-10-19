import { getProduct } from "@/config/products";
import { buildOverview } from "@/lib/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getProduct(id)) return Response.json({ error: "Unknown product" }, { status: 404 });
  return Response.json(buildOverview(id));
}
