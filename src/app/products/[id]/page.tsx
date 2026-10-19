import { notFound } from "next/navigation";
import { AskPanel } from "@/components/AskPanel";
import { SentimentSummary, ThreadList } from "@/components/Dashboard";
import { RefreshButton } from "@/components/RefreshButton";
import { SentimentTrend } from "@/components/SentimentTrend";
import { getProduct } from "@/config/products";
import { timeAgo } from "@/lib/format";
import { buildOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-card p-4 ${className}`}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();
  const o = buildOverview(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-muted">{product.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
            <a className="hover:text-accent" href={product.techCommunityUrl} target="_blank" rel="noreferrer">
              Tech Community ↗
            </a>
            {product.subreddits.map((s) => (
              <a key={s} className="hover:text-accent" href={`https://www.reddit.com/r/${s}`} target="_blank" rel="noreferrer">
                r/{s} ↗
              </a>
            ))}
          </div>
        </div>
        {process.env.NODE_ENV !== "production" && <RefreshButton productId={id} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Overall sentiment">
          <SentimentSummary s={o.sentiment} />
        </Card>
        <Card title="Sentiment trend (30 days)">
          <SentimentTrend data={o.sentiment.trend} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Most recent issues">
          {o.issues.length === 0 ? (
            <p className="py-6 text-sm text-muted">No issue clusters yet. Run a sync to ingest discussions.</p>
          ) : (
            <ul className="space-y-3">
              {o.issues.map((i) => (
                <li key={i.title} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{i.title}</span>
                    <span className="rounded-full bg-neg/15 px-2 py-0.5 text-xs text-neg">{i.count} posts</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{i.description}</p>
                  <div className="mt-0.5 text-xs text-muted">
                    latest {timeAgo(i.latestAt)}
                    {" · "}
                    <a href={i.latestUrl} target="_blank" rel="noreferrer" className="hover:text-accent">
                      view thread ↗
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Top Reddit posts (by upvotes)">
          <ThreadList
            threads={o.topReddit}
            empty={product.subreddits.length ? "No Reddit posts yet. Configure Reddit credentials and sync." : "No subreddit is configured for this product."}
          />
        </Card>
      </div>

      <Card title="Latest discussions">
        <ThreadList threads={o.latestThreads} empty="No discussions ingested yet." />
      </Card>

      <Card title="Data sources">
        {o.sync.length === 0 ? (
          <p className="text-sm text-muted">Never synced.</p>
        ) : (
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {o.sync.map((s) => (
              <li key={s.source}>
                <span className="font-medium">{s.source === "reddit" ? "Reddit" : "Tech Community"}</span>{" "}
                <span className="text-muted">
                  {s.status} · {timeAgo(s.lastFinishedAt)}
                  {s.error ? ` · ${s.error}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Ask about ${product.name}`}>
        <AskPanel productId={id} productName={product.name} />
      </Card>
    </div>
  );
}
