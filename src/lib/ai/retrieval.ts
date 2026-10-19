import { getThreadsByIds, listEmbeddings, searchKeyword } from "@/lib/db";
import { env } from "@/lib/env";
import { cosine, truncate } from "@/lib/text";
import { embed } from "@/lib/ai/client";
import { learnToCitations, searchLearn } from "@/lib/sources/learn";
import { getProduct } from "@/config/products";
import type { Citation, SourceKind, Thread } from "@/lib/types";

const RRF_K = 60;

/** Reciprocal rank fusion over several ranked id lists. */
export function fuseRanks(lists: string[][], limit: number): string[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank + 1)));
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

async function searchCommunity(query: string, productId: string | null, limit: number): Promise<Thread[]> {
  const keyword = searchKeyword(query, productId, limit * 2);
  const lists = [keyword.map((t) => t.id)];
  if (env.aiConfigured) {
    try {
      const [qv] = await embed([query]);
      const ranked = listEmbeddings(productId)
        .map((e) => ({ id: e.id, s: cosine(qv, e.vector) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, limit * 2)
        .map((e) => e.id);
      lists.push(ranked);
    } catch (err) {
      console.warn("Vector search failed, using keyword only:", err instanceof Error ? err.message : err);
    }
  }
  const ids = fuseRanks(lists, limit);
  const byId = new Map(getThreadsByIds(ids).map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter((t): t is Thread => Boolean(t));
}

export interface RetrievalOptions {
  productId: string | null;
  sources: SourceKind[];
  perSource?: number;
}

export async function retrieve(query: string, opts: RetrievalOptions): Promise<Citation[]> {
  const perSource = opts.perSource ?? 5;
  const product = opts.productId ? getProduct(opts.productId) : undefined;
  const citations: Citation[] = [];
  const wantLearn = opts.sources.includes("learn");

  const [learn, community] = await Promise.all([
    wantLearn
      ? searchLearn(product ? `${query} ${product.learnHint}` : query, perSource).catch((err) => {
          console.warn("Learn MCP search failed:", err instanceof Error ? err.message : err);
          return [];
        })
      : Promise.resolve([]),
    opts.sources.some((s) => s !== "learn") ? searchCommunity(query, opts.productId, perSource * 2) : Promise.resolve([]),
  ]);

  citations.push(...learnToCitations(learn, 1));
  let n = citations.length + 1;
  for (const t of community) {
    if (!opts.sources.includes(t.source)) continue;
    citations.push({
      n: n++,
      source: t.source,
      title: t.title,
      url: t.url,
      snippet: truncate(t.body.replace(/\s+/g, " "), 700),
      date: t.createdAt,
      score: t.score,
    });
  }
  return citations;
}
