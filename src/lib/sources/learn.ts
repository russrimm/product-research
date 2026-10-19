import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { env } from "@/lib/env";
import { truncate } from "@/lib/text";
import type { Citation } from "@/lib/types";

export interface LearnResult {
  title: string;
  url: string;
  content: string;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "product-research", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(env.learnMcpUrl));
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function textOf(result: { content?: unknown }): string {
  const blocks = Array.isArray(result.content) ? result.content : [];
  return blocks
    .map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text) : ""))
    .join("\n");
}

/** Normalizes the MCP search payload, which is JSON (`results` or a bare array) or plain text. */
export function parseLearnSearch(text: string): LearnResult[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { results?: unknown[] })?.results)
        ? (parsed as { results: unknown[] }).results
        : [];
    return list
      .map((r) => r as Record<string, unknown>)
      .filter((r) => typeof r.contentUrl === "string" || typeof r.url === "string")
      .map((r) => ({
        title: String(r.title ?? "Microsoft Learn"),
        url: String(r.contentUrl ?? r.url),
        content: String(r.content ?? r.description ?? ""),
      }));
  } catch {
    return [];
  }
}

export async function searchLearn(query: string, limit = 5): Promise<LearnResult[]> {
  const result = await withClient((c) => c.callTool({ name: "microsoft_docs_search", arguments: { query } }));
  return parseLearnSearch(textOf(result as { content?: unknown })).slice(0, limit);
}

export function learnToCitations(results: LearnResult[], startAt: number): Citation[] {
  return results.map((r, i) => ({
    n: startAt + i,
    source: "learn" as const,
    title: r.title,
    url: r.url,
    snippet: truncate(r.content.replace(/\s+/g, " "), 700),
  }));
}
