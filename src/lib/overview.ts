import {
  countBySource,
  lastRunBySource,
  listRecentThreads,
  listTopRedditThreads,
} from "@/lib/db";
import { getIssues } from "@/lib/ai/issues";
import { labelForScore } from "@/lib/ai/heuristics";
import type { ProductOverview, SentimentBucket, Thread } from "@/lib/types";

const HALF_LIFE_DAYS = 14;
const TREND_DAYS = 30;

export function recencyWeightedAverage(threads: Thread[], now = Date.now()): number | null {
  let num = 0;
  let den = 0;
  for (const t of threads) {
    if (t.sentimentScore === null) continue;
    const ageDays = Math.max(0, (now - new Date(t.createdAt).getTime()) / 86_400_000);
    const w = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    num += t.sentimentScore * w;
    den += w;
  }
  return den === 0 ? null : Math.round((num / den) * 100) / 100;
}

export function dailyTrend(threads: Thread[], days = TREND_DAYS, now = Date.now()): SentimentBucket[] {
  const cutoff = now - days * 86_400_000;
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const t of threads) {
    if (t.sentimentScore === null) continue;
    const ts = new Date(t.createdAt).getTime();
    if (ts < cutoff) continue;
    const day = new Date(ts).toISOString().slice(0, 10);
    const b = buckets.get(day) ?? { sum: 0, count: 0 };
    b.sum += t.sentimentScore;
    b.count += 1;
    buckets.set(day, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, b]) => ({ day, avg: Math.round((b.sum / b.count) * 100) / 100, count: b.count }));
}

export function buildOverview(productId: string): ProductOverview {
  const recent = listRecentThreads(productId, 400);
  const analyzed = recent.filter((t) => t.sentimentScore !== null);
  const avg = recencyWeightedAverage(analyzed);
  return {
    productId,
    sentiment: {
      avg,
      label: labelForScore(avg),
      positive: analyzed.filter((t) => t.sentimentLabel === "positive").length,
      neutral: analyzed.filter((t) => t.sentimentLabel === "neutral").length,
      negative: analyzed.filter((t) => t.sentimentLabel === "negative").length,
      analyzed: analyzed.length,
      trend: dailyTrend(analyzed),
    },
    issues: getIssues(productId),
    topReddit: listTopRedditThreads(productId, 8),
    latestThreads: recent.slice(0, 12),
    sync: lastRunBySource(productId),
    counts: countBySource(productId),
  };
}
