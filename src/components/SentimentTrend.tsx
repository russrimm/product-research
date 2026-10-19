"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SentimentBucket } from "@/lib/types";

export function SentimentTrend({ data }: { data: SentimentBucket[] }) {
  if (data.length < 2) {
    return <p className="py-10 text-center text-sm text-muted">Not enough data for a trend yet.</p>;
  }
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} tickFormatter={(d: string) => d.slice(5)} />
          <YAxis domain={[-1, 1]} tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <Tooltip
            contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", fontSize: 12 }}
            formatter={(value, _name, item) => [`${value} (${item.payload.count} posts)`, "Sentiment"]}
          />
          <Line type="monotone" dataKey="avg" stroke="var(--accent)" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
