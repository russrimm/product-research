import { env } from "@/lib/env";
import { htmlToText, truncate } from "@/lib/text";
import type { ThreadInput } from "@/lib/db";
import type { ProductConfig } from "@/config/products";

interface RedditChild {
  data: {
    id: string;
    name: string;
    title: string;
    selftext?: string;
    author: string;
    created_utc: number;
    score: number;
    num_comments: number;
    permalink: string;
    subreddit: string;
    stickied?: boolean;
    over_18?: boolean;
  };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const basic = Buffer.from(`${env.redditClientId}:${env.redditClientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": env.redditUserAgent,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Reddit token request failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export function mapRedditPosts(children: RedditChild[], productId: string): ThreadInput[] {
  return children
    .filter((c) => !c.data.stickied && !c.data.over_18)
    .map((c) => ({
      id: `reddit:${c.data.id}`,
      productId,
      source: "reddit" as const,
      board: `r/${c.data.subreddit}`,
      url: `https://www.reddit.com${c.data.permalink}`,
      title: htmlToText(c.data.title),
      body: truncate(htmlToText(c.data.selftext ?? ""), 6000),
      author: c.data.author,
      createdAt: new Date(c.data.created_utc * 1000).toISOString(),
      score: c.data.score,
      commentCount: c.data.num_comments,
    }));
}

async function fetchListing(sub: string, sort: "new" | "top", token: string): Promise<RedditChild[]> {
  const params = sort === "top" ? "?t=month&limit=50" : "?limit=50";
  const res = await fetch(`https://oauth.reddit.com/r/${encodeURIComponent(sub)}/${sort}${params}`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": env.redditUserAgent },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404 || res.status === 403) return [];
  if (!res.ok) throw new Error(`Reddit r/${sub}/${sort} returned ${res.status}`);
  const json = (await res.json()) as { data?: { children?: RedditChild[] } };
  return json.data?.children ?? [];
}

export async function fetchReddit(product: ProductConfig): Promise<ThreadInput[]> {
  const token = await getToken();
  const byId = new Map<string, ThreadInput>();
  for (const sub of product.subreddits) {
    for (const sort of ["new", "top"] as const) {
      const children = await fetchListing(sub, sort, token);
      for (const t of mapRedditPosts(children, product.id)) byId.set(t.id, t);
    }
  }
  return [...byId.values()];
}
