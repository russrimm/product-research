import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "pr-db-"));
  process.env.DATABASE_PATH = join(dir, "test.db");
});

afterAll(() => {
  const g = globalThis as { __db?: { close(): void } };
  g.__db?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("database", () => {
  it("upserts, searches and analyzes threads", async () => {
    const db = await import("@/lib/db");
    const { analyzePending } = await import("@/lib/ai/analysis");
    const { buildOverview } = await import("@/lib/overview");
    const base = {
      productId: "copilot-studio",
      source: "reddit" as const,
      board: "r/CopilotStudio",
      author: "u",
      createdAt: new Date().toISOString(),
    };
    expect(
      db.upsertThread({ ...base, id: "reddit:1", url: "https://r/1", title: "Connector error 403", body: "SharePoint connector fails", score: 5, commentCount: 2 }),
    ).toBe(true);
    db.upsertThread({ ...base, id: "reddit:2", url: "https://r/2", title: "Loving the new agent flows", body: "Great, thanks, works", score: 30, commentCount: 4 });

    // Re-ingest with new score: no reanalysis needed.
    expect(
      db.upsertThread({ ...base, id: "reddit:1", url: "https://r/1", title: "Connector error 403", body: "SharePoint connector fails", score: 9, commentCount: 3 }),
    ).toBe(false);

    expect(db.searchKeyword("sharepoint connector", "copilot-studio", 5).map((t) => t.id)).toEqual(["reddit:1"]);
    expect(db.searchKeyword("sharepoint", "foundry", 5)).toHaveLength(0);

    const res = await analyzePending();
    expect(res.analyzed).toBe(2);

    const overview = buildOverview("copilot-studio");
    expect(overview.counts.reddit).toBe(2);
    expect(overview.topReddit[0].id).toBe("reddit:2");
    expect(overview.sentiment.analyzed).toBe(2);
    expect(overview.issues.some((i) => i.title === "Connectors & integrations")).toBe(true);
  });
});
