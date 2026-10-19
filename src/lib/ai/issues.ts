import { listRecentThreads, saveInsights, loadInsights } from "@/lib/db";
import type { IssueCluster, Thread } from "@/lib/types";

const WINDOW_DAYS = 45;

/** Groups threads by their issue tags (LLM- or heuristic-generated) and ranks by volume then recency. */
export function clusterByTags(threads: Thread[], maxClusters = 8): IssueCluster[] {
  const groups = new Map<string, Thread[]>();
  for (const t of threads) {
    if ((t.sentimentScore ?? 0) > 0.4) continue;
    for (const tag of t.issueTags) {
      const key = tag.trim();
      if (!key) continue;
      const list = groups.get(key) ?? [];
      list.push(t);
      groups.set(key, list);
    }
  }
  return [...groups.entries()]
    .map(([title, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        title,
        description: sorted[0].summary ?? sorted[0].title,
        count: list.length,
        threadIds: sorted.map((t) => t.id),
        latestAt: sorted[0].createdAt,
        latestUrl: sorted[0].url,
      };
    })
    .sort((a, b) => b.count - a.count || b.latestAt.localeCompare(a.latestAt))
    .slice(0, maxClusters);
}

export function refreshIssues(productId: string): IssueCluster[] {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const clusters = clusterByTags(listRecentThreads(productId, 300, since));
  saveInsights(productId, JSON.stringify(clusters));
  return clusters;
}

export function getIssues(productId: string): IssueCluster[] {
  const cached = loadInsights(productId);
  if (cached) return JSON.parse(cached.issuesJson) as IssueCluster[];
  return refreshIssues(productId);
}
