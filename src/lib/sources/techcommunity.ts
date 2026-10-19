import { XMLParser } from "fast-xml-parser";
import { htmlToText, truncate } from "@/lib/text";
import type { ThreadInput } from "@/lib/db";
import type { ProductConfig } from "@/config/products";

const FEED_BASE = "https://techcommunity.microsoft.com/t5/s/gxcuf89792/rss/board";

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

/** Parses a Tech Community board RSS feed. Only forum discussions (m-p) are kept; blogs and events are skipped. */
export function parseBoardRss(xml: string, productId: string, board: string): ThreadInput[] {
  const doc = parser.parse(xml);
  if (String(doc?.rss?.channel?.title ?? "") === "Resource Not Found") {
    throw new Error(`Tech Community board "${board}" was not found (check the board id)`);
  }
  const raw = doc?.rss?.channel?.item;
  const items: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: ThreadInput[] = [];
  for (const item of items) {
    const link = String(item.link ?? "");
    const match = link.match(/\/m-p\/(\d+)/);
    if (!match) continue;
    const date = new Date(String(item["dc:date"] ?? item.pubDate ?? ""));
    out.push({
      id: `tc:${match[1]}`,
      productId,
      source: "techcommunity",
      board,
      url: link.replace(/#.*$/, ""),
      title: htmlToText(String(item.title ?? "")),
      body: truncate(htmlToText(String(item.description ?? "")), 6000),
      author: String(item["dc:creator"] ?? ""),
      createdAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      score: null,
      commentCount: null,
    });
  }
  return out;
}

export async function fetchTechCommunity(product: ProductConfig): Promise<ThreadInput[]> {
  const all: ThreadInput[] = [];
  for (const board of product.techCommunityBoards) {
    const res = await fetch(`${FEED_BASE}?board.id=${encodeURIComponent(board)}`, {
      headers: { "User-Agent": "product-research/0.1 (community research tool)", Accept: "application/rss+xml, text/xml" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Tech Community feed ${board} returned ${res.status}`);
    all.push(...parseBoardRss(await res.text(), product.id, board));
  }
  return all;
}
