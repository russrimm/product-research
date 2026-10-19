import { env } from "@/lib/env";
import { chatStream, type ChatMessage } from "@/lib/ai/client";
import { retrieve } from "@/lib/ai/retrieval";
import { getProduct } from "@/config/products";
import type { Citation, SourceKind } from "@/lib/types";

export type AskEvent =
  | { type: "citations"; citations: Citation[] }
  | { type: "token"; text: string }
  | { type: "notice"; text: string }
  | { type: "done" };

const SYSTEM = `You are a Microsoft product research assistant. Answer the user's question using ONLY the numbered sources provided.
Source kinds: "learn" = official Microsoft Learn documentation (authoritative); "techcommunity" = Microsoft Community Hub posts and "reddit" = Reddit posts (community opinions and experiences, NOT official guidance).
Rules:
- Cite every claim with bracketed source numbers like [1] or [2][4].
- Prefer Learn for how-things-work facts. Use community sources for real-world issues, workarounds and sentiment, and label them clearly as community reports.
- If sources disagree, say so. If they do not answer the question, say what is missing instead of guessing.
- Be concise: short paragraphs or bullets, no preamble.`;

export function buildMessages(question: string, citations: Citation[]): ChatMessage[] {
  const context = citations
    .map(
      (c) =>
        `[${c.n}] (${c.source}${c.date ? `, ${c.date.slice(0, 10)}` : ""}${c.score != null ? `, ${c.score} upvotes` : ""}) ${c.title}\n${c.snippet}`,
    )
    .join("\n\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Sources:\n${context || "(none found)"}\n\nQuestion: ${question}` },
  ];
}

function extractiveAnswer(citations: Citation[]): string {
  if (citations.length === 0) return "No matching sources were found. Try different keywords or run an ingest.";
  const lines = citations.slice(0, 6).map((c) => {
    const label = c.source === "learn" ? "Docs" : c.source === "reddit" ? "Reddit" : "Community Hub";
    return `- **${label}:** ${c.title} [${c.n}]`;
  });
  return `AI synthesis is not configured (set the AZURE_OPENAI_* variables). Closest matches:\n\n${lines.join("\n")}`;
}

export async function* ask(
  question: string,
  opts: { productId: string | null; sources: SourceKind[] },
): AsyncGenerator<AskEvent> {
  const product = opts.productId ? getProduct(opts.productId) : undefined;
  const citations = await retrieve(question, opts);
  yield { type: "citations", citations };

  if (!env.aiConfigured) {
    yield { type: "notice", text: "Running without an AI model; showing extractive results." };
    yield { type: "token", text: extractiveAnswer(citations) };
    yield { type: "done" };
    return;
  }
  if (citations.length === 0) {
    yield { type: "token", text: `No sources found${product ? ` for ${product.name}` : ""}. Try broader keywords or another source.` };
    yield { type: "done" };
    return;
  }
  try {
    for await (const text of chatStream(buildMessages(question, citations))) yield { type: "token", text };
  } catch (err) {
    yield { type: "notice", text: `The model request failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
  yield { type: "done" };
}
