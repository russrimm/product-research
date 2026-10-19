"use client";

import { useState } from "react";
import type { Citation, SourceKind } from "@/lib/types";

const SOURCE_LABEL: Record<SourceKind, string> = {
  learn: "Microsoft Learn",
  techcommunity: "Tech Community",
  reddit: "Reddit",
};

const SOURCE_STYLE: Record<SourceKind, string> = {
  learn: "bg-accent/15 text-accent",
  techcommunity: "bg-neu/15 text-neu",
  reddit: "bg-neg/15 text-neg",
};

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const cite = part.match(/^\[(\d+)\]$/);
    if (cite) {
      return (
        <a key={i} href={`#cite-${cite[1]}`} className="mx-0.5 align-super text-[0.7em] font-semibold text-accent">
          [{cite[1]}]
        </a>
      );
    }
    return part;
  });
}

export function AskPanel({ productId, productName }: { productId: string | null; productName?: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Record<SourceKind, boolean>>({ learn: true, techcommunity: true, reddit: true });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3 || loading) return;
    setLoading(true);
    setAnswer("");
    setCitations([]);
    setNotice("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          productId,
          sources: (Object.keys(sources) as SourceKind[]).filter((s) => sources[s]),
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { type: string; text?: string; citations?: Citation[] };
          if (ev.type === "citations") setCitations(ev.citations ?? []);
          else if (ev.type === "token") setAnswer((a) => a + (ev.text ?? ""));
          else if (ev.type === "notice") setNotice(ev.text ?? "");
        }
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder={`Ask anything${productName ? ` about ${productName}` : " about Microsoft Foundry, Copilot Studio, Microsoft Copilot…"}`}
          className="w-full rounded-lg border border-line bg-card p-3 text-sm outline-none focus:border-accent"
        />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {(Object.keys(SOURCE_LABEL) as SourceKind[]).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-muted">
              <input
                type="checkbox"
                checked={sources[s]}
                onChange={(e) => setSources((prev) => ({ ...prev, [s]: e.target.checked }))}
              />
              {SOURCE_LABEL[s]}
            </label>
          ))}
          <button
            type="submit"
            disabled={loading || question.trim().length < 3 || !Object.values(sources).some(Boolean)}
            className="ml-auto rounded-md bg-accent px-4 py-1.5 font-medium text-background disabled:opacity-50"
          >
            {loading ? "Researching…" : "Ask"}
          </button>
        </div>
      </form>

      {notice && <p className="rounded-md border border-line bg-card px-3 py-2 text-xs text-muted">{notice}</p>}

      {(answer || loading) && (
        <article className="whitespace-pre-wrap rounded-lg border border-line bg-card p-4 text-sm leading-relaxed">
          {answer ? renderInline(answer) : <span className="text-muted">Searching sources…</span>}
        </article>
      )}

      {citations.length > 0 && (
        <ol className="grid gap-2 sm:grid-cols-2">
          {citations.map((c) => (
            <li key={c.n} id={`cite-${c.n}`} className="rounded-lg border border-line p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 text-xs">
                <span className="font-semibold">[{c.n}]</span>
                <span className={`rounded px-1.5 py-0.5 ${SOURCE_STYLE[c.source]}`}>{SOURCE_LABEL[c.source]}</span>
                {c.score != null && <span className="text-muted">▲ {c.score}</span>}
                {c.date && <span className="text-muted">{c.date.slice(0, 10)}</span>}
              </div>
              <a href={c.url} target="_blank" rel="noreferrer" className="font-medium hover:text-accent">
                {c.title}
              </a>
              <p className="mt-1 line-clamp-3 text-xs text-muted">{c.snippet}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
