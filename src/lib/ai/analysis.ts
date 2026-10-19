import { listNeedingAnalysis, listNeedingEmbedding, setAnalysis, setEmbedding } from "@/lib/db";
import { env } from "@/lib/env";
import { truncate } from "@/lib/text";
import { chatJson, embed } from "@/lib/ai/client";
import { heuristicSentiment, heuristicTags, labelForScore } from "@/lib/ai/heuristics";
import type { Thread } from "@/lib/types";

const BATCH = 8;

interface LlmItem {
  id: string;
  score: number;
  tags?: string[];
  summary?: string;
}

const SYSTEM = `You analyze community posts about Microsoft products (forums and Reddit).
For each post return sentiment toward the PRODUCT (not the author's mood): a score from -1 (very negative) to 1 (very positive), up to 3 short issue tags (2-4 words, Title Case, e.g. "SharePoint Connector Errors"; empty when the post is not about a problem), and a one-sentence neutral summary.
Respond with JSON: {"items":[{"id":string,"score":number,"tags":string[],"summary":string}]}.`;

async function analyzeBatchWithLlm(batch: Thread[]): Promise<Map<string, LlmItem>> {
  const payload = batch.map((t) => ({ id: t.id, title: t.title, body: truncate(t.body, 1200) }));
  const out = await chatJson<{ items?: LlmItem[] }>([
    { role: "system", content: SYSTEM },
    { role: "user", content: JSON.stringify(payload) },
  ]);
  return new Map((out.items ?? []).map((i) => [i.id, i]));
}

export async function analyzePending(limit = 80): Promise<{ analyzed: number; usedLlm: boolean }> {
  const pending = listNeedingAnalysis(limit);
  let usedLlm = false;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    let llm = new Map<string, LlmItem>();
    if (env.aiConfigured) {
      try {
        llm = await analyzeBatchWithLlm(batch);
        usedLlm = true;
      } catch (err) {
        console.warn("LLM analysis failed, using heuristics:", err instanceof Error ? err.message : err);
      }
    }
    for (const t of batch) {
      const hit = llm.get(t.id);
      if (hit && typeof hit.score === "number") {
        const score = Math.max(-1, Math.min(1, hit.score));
        setAnalysis(t.id, labelForScore(score) ?? "neutral", score, (hit.tags ?? []).slice(0, 3), hit.summary ?? null);
      } else {
        const text = `${t.title}\n${t.body}`;
        const h = heuristicSentiment(text);
        setAnalysis(t.id, h.label, h.score, heuristicTags(text), null);
      }
    }
  }
  return { analyzed: pending.length, usedLlm };
}

export async function embedPending(limit = 100): Promise<number> {
  if (!env.aiConfigured) return 0;
  const pending = listNeedingEmbedding(limit);
  for (let i = 0; i < pending.length; i += 16) {
    const batch = pending.slice(i, i + 16);
    const vectors = await embed(batch.map((t) => truncate(`${t.title}\n${t.body}`, 3000)));
    batch.forEach((t, idx) => setEmbedding(t.id, vectors[idx]));
  }
  return pending.length;
}
