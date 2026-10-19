import { sentimentColor, timeAgo } from "@/lib/format";
import type { ProductOverview, Thread } from "@/lib/types";

export function SentimentSummary({ s }: { s: ProductOverview["sentiment"] }) {
  const total = Math.max(1, s.analyzed);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className={`text-4xl font-semibold tabular-nums ${sentimentColor(s.label)}`}>
          {s.avg === null ? "–" : s.avg > 0 ? `+${s.avg.toFixed(2)}` : s.avg.toFixed(2)}
        </span>
        <span className={`text-sm font-medium capitalize ${sentimentColor(s.label)}`}>{s.label ?? "no data"}</span>
        <span className="text-xs text-muted">{s.analyzed} posts analyzed</span>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-line" role="img" aria-label="Sentiment distribution">
        <div className="bg-pos" style={{ width: pct(s.positive) }} />
        <div className="bg-neu" style={{ width: pct(s.neutral) }} />
        <div className="bg-neg" style={{ width: pct(s.negative) }} />
      </div>
      <div className="mt-1.5 flex gap-4 text-xs text-muted">
        <span>{s.positive} positive</span>
        <span>{s.neutral} neutral</span>
        <span>{s.negative} negative</span>
      </div>
    </div>
  );
}

export function SourceBadge({ source, board }: { source: Thread["source"]; board: string }) {
  const style = source === "reddit" ? "bg-neg/15 text-neg" : "bg-neu/15 text-neu";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${style}`}>{source === "reddit" ? board : "Tech Community"}</span>
  );
}

export function ThreadList({ threads, empty }: { threads: Thread[]; empty: string }) {
  if (threads.length === 0) return <p className="py-6 text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {threads.map((t) => (
        <li key={t.id} className="flex items-start gap-3 py-3">
          {t.source === "reddit" && (
            <div className="w-12 shrink-0 text-center text-sm tabular-nums">
              <div className="text-accent">▲</div>
              <div className="font-semibold">{t.score ?? 0}</div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <a href={t.url} target="_blank" rel="noreferrer" className="font-medium hover:text-accent">
              {t.title}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <SourceBadge source={t.source} board={t.board} />
              <span>{timeAgo(t.createdAt)}</span>
              {t.commentCount != null && <span>{t.commentCount} comments</span>}
              {t.sentimentLabel && (
                <span className={`capitalize ${sentimentColor(t.sentimentLabel)}`}>{t.sentimentLabel}</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
