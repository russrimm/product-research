import { describe, expect, it } from "vitest";
import { heuristicSentiment, heuristicTags } from "@/lib/ai/heuristics";
import { clusterByTags } from "@/lib/ai/issues";
import { fuseRanks } from "@/lib/ai/retrieval";
import { dailyTrend, recencyWeightedAverage } from "@/lib/overview";
import { cosine } from "@/lib/text";
import type { Thread } from "@/lib/types";

const NOW = Date.parse("2026-10-16T12:00:00Z");

function thread(over: Partial<Thread>): Thread {
  return {
    id: "tc:1",
    productId: "p",
    source: "techcommunity",
    board: "b",
    url: "https://example.com/1",
    title: "t",
    body: "",
    author: "a",
    createdAt: new Date(NOW).toISOString(),
    score: null,
    commentCount: null,
    sentimentLabel: null,
    sentimentScore: null,
    issueTags: [],
    summary: null,
    ...over,
  };
}

describe("heuristics", () => {
  it("scores sentiment and tags topics", () => {
    expect(heuristicSentiment("It is broken and fails with an error").label).toBe("negative");
    expect(heuristicSentiment("Great, thanks! It works and is awesome").label).toBe("positive");
    expect(heuristicSentiment("How do I configure this?").label).toBe("neutral");
    expect(heuristicTags("SharePoint connector returns 403")).toEqual(
      expect.arrayContaining(["Connectors & integrations", "Authentication & permissions"]),
    );
  });
});

describe("aggregation", () => {
  it("weights recent posts more heavily", () => {
    const recent = thread({ id: "a", sentimentScore: -0.8 });
    const old = thread({ id: "b", sentimentScore: 0.8, createdAt: new Date(NOW - 60 * 86_400_000).toISOString() });
    expect(recencyWeightedAverage([recent, old], NOW)!).toBeLessThan(-0.5);
    expect(recencyWeightedAverage([thread({})], NOW)).toBeNull();
  });

  it("buckets sentiment by day within the window", () => {
    const rows = [
      thread({ id: "a", sentimentScore: 1 }),
      thread({ id: "b", sentimentScore: 0 }),
      thread({ id: "c", sentimentScore: -1, createdAt: new Date(NOW - 90 * 86_400_000).toISOString() }),
    ];
    expect(dailyTrend(rows, 30, NOW)).toEqual([{ day: "2026-10-16", avg: 0.5, count: 2 }]);
  });

  it("clusters negative threads by tag, ranked by volume", () => {
    const rows = [
      thread({ id: "1", issueTags: ["Auth Errors"], sentimentScore: -0.5 }),
      thread({ id: "2", issueTags: ["Auth Errors", "Slow Responses"], sentimentScore: -0.2, createdAt: "2026-10-10T00:00:00Z" }),
      thread({ id: "3", issueTags: ["Auth Errors"], sentimentScore: 0.9 }),
    ];
    const clusters = clusterByTags(rows);
    expect(clusters[0]).toMatchObject({ title: "Auth Errors", count: 2 });
    expect(clusters[0].threadIds[0]).toBe("1");
    expect(clusters).toHaveLength(2);
  });
});

describe("retrieval helpers", () => {
  it("fuses ranked lists with reciprocal rank fusion", () => {
    expect(fuseRanks([["a", "b", "c"], ["b", "a"]], 2)).toEqual(["a", "b"]);
    expect(fuseRanks([["x"], ["y"], ["y"]], 1)).toEqual(["y"]);
  });

  it("computes cosine similarity", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([], [])).toBe(0);
  });
});
