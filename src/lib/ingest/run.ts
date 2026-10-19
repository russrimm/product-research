import { fetchReddit } from "@/lib/sources/reddit";
import { fetchTechCommunity } from "@/lib/sources/techcommunity";
import { finishRun, startRun, upsertThread, type ThreadInput } from "@/lib/db";
import { analyzePending, embedPending } from "@/lib/ai/analysis";
import { refreshIssues } from "@/lib/ai/issues";
import { env } from "@/lib/env";
import { PRODUCTS, type ProductConfig } from "@/config/products";

export interface IngestSummary {
  productId: string;
  techcommunity: { status: string; fetched: number; error?: string };
  reddit: { status: string; fetched: number; error?: string };
}

let running: Promise<IngestSummary[]> | null = null;

async function runSource(
  source: "techcommunity" | "reddit",
  product: ProductConfig,
  fetcher: (p: ProductConfig) => Promise<ThreadInput[]>,
  enabled: boolean,
): Promise<{ status: string; fetched: number; error?: string }> {
  const runId = startRun(source, product.id);
  if (!enabled) {
    finishRun(runId, "skipped", 0, "Not configured");
    return { status: "skipped", fetched: 0 };
  }
  try {
    const threads = await fetcher(product);
    for (const t of threads) upsertThread(t);
    finishRun(runId, "ok", threads.length);
    return { status: "ok", fetched: threads.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    finishRun(runId, "error", 0, message);
    return { status: "error", fetched: 0, error: message };
  }
}

async function ingestAllInner(productIds?: string[]): Promise<IngestSummary[]> {
  const products = PRODUCTS.filter((p) => !productIds || productIds.includes(p.id));
  const summaries: IngestSummary[] = [];
  for (const product of products) {
    const techcommunity = await runSource("techcommunity", product, fetchTechCommunity, product.techCommunityBoards.length > 0);
    const reddit = await runSource("reddit", product, fetchReddit, product.subreddits.length > 0 && env.redditConfigured);
    summaries.push({ productId: product.id, techcommunity, reddit });
  }
  await analyzePending(200);
  await embedPending(200).catch((err) => console.warn("Embedding failed:", err instanceof Error ? err.message : err));
  for (const product of products) refreshIssues(product.id);
  return summaries;
}

/** Single-flight: concurrent callers share the in-progress run. */
export function ingestAll(productIds?: string[]): Promise<IngestSummary[]> {
  if (!running) {
    running = ingestAllInner(productIds).finally(() => {
      running = null;
    });
  }
  return running;
}
