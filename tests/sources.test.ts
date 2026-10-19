import { describe, expect, it } from "vitest";
import { parseBoardRss } from "@/lib/sources/techcommunity";
import { mapRedditPosts } from "@/lib/sources/reddit";
import { parseLearnSearch } from "@/lib/sources/learn";
import { htmlToText } from "@/lib/text";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<item>
  <title>Help building an Agent Flow</title>
  <link>https://techcommunity.microsoft.com/t5/copilot-studio/help-building/m-p/4564436#M271</link>
  <description>&lt;P&gt;Hi all,&amp;nbsp;I get an &lt;B&gt;error&lt;/B&gt;&lt;BR /&gt;thanks&lt;/P&gt;</description>
  <pubDate>Wed, 14 Oct 2026 09:50:35 GMT</pubDate>
  <dc:creator>hamdhan777</dc:creator>
  <dc:date>2026-10-14T09:50:35Z</dc:date>
</item>
<item>
  <title>A blog post</title>
  <link>https://techcommunity.microsoft.com/t5/blog/some-post/ba-p/123</link>
  <description>blog</description>
</item>
</channel></rss>`;

describe("parseBoardRss", () => {
  it("keeps forum threads, skips blogs, and cleans HTML", () => {
    const out = parseBoardRss(RSS, "copilot-studio", "copilot-studio");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "tc:4564436",
      source: "techcommunity",
      author: "hamdhan777",
      createdAt: "2026-10-14T09:50:35.000Z",
      url: "https://techcommunity.microsoft.com/t5/copilot-studio/help-building/m-p/4564436",
    });
    expect(out[0].body).toBe("Hi all, I get an error\nthanks");
  });

  it("handles a feed with a single item", () => {
    const single = RSS.replace(/<item>[\s\S]*?<\/item>\s*<item>/, "<item>");
    expect(parseBoardRss(single, "p", "b")).toHaveLength(0);
  });
});

describe("mapRedditPosts", () => {
  it("maps score and comments and drops stickied/NSFW posts", () => {
    const base = {
      id: "abc",
      name: "t3_abc",
      title: "Copilot Studio &amp; flows",
      selftext: "body",
      author: "u1",
      created_utc: 1_760_000_000,
      score: 42,
      num_comments: 7,
      permalink: "/r/CopilotStudio/comments/abc/x/",
      subreddit: "CopilotStudio",
    };
    const out = mapRedditPosts(
      [{ data: base }, { data: { ...base, id: "s", stickied: true } }, { data: { ...base, id: "n", over_18: true } }],
      "copilot-studio",
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "reddit:abc",
      title: "Copilot Studio & flows",
      score: 42,
      commentCount: 7,
      board: "r/CopilotStudio",
      url: "https://www.reddit.com/r/CopilotStudio/comments/abc/x/",
    });
  });
});

describe("parseLearnSearch", () => {
  it("parses results and tolerates non-JSON text", () => {
    const json = JSON.stringify({ results: [{ title: "T", contentUrl: "https://learn.microsoft.com/x", content: "c" }] });
    expect(parseLearnSearch(json)).toEqual([{ title: "T", url: "https://learn.microsoft.com/x", content: "c" }]);
    expect(parseLearnSearch("not json")).toEqual([]);
  });
});

describe("htmlToText", () => {
  it("decodes entities and strips tags", () => {
    expect(htmlToText("<p>a&nbsp;&amp;&#33; b</p>")).toBe("a &! b");
  });
});
