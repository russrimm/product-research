import Link from "next/link";
import { AskPanel } from "@/components/AskPanel";
import { PRODUCTS } from "@/config/products";
import { buildOverview } from "@/lib/overview";
import { sentimentColor } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function Home() {
  const cards = PRODUCTS.map((p) => ({ product: p, overview: buildOverview(p.id) }));
  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Research Microsoft products with the community</h1>
        <p className="max-w-2xl text-muted">
          Cited answers from Microsoft Learn, Tech Community and Reddit, plus live sentiment, recent issues and upvotes.
        </p>
      </section>

      <AskPanel productId={null} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Community pulse</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ product, overview }) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="rounded-lg border border-line bg-card p-4 transition hover:border-accent"
            >
              <div className="font-medium">{product.name}</div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{product.tagline}</p>
              <div className={`mt-3 text-2xl font-semibold tabular-nums ${sentimentColor(overview.sentiment.label)}`}>
                {overview.sentiment.avg === null ? "–" : overview.sentiment.avg.toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-muted">
                {overview.counts.techcommunity} forum · {overview.counts.reddit} Reddit
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
