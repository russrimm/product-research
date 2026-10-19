export type SourceKind = "techcommunity" | "reddit" | "learn";
export type SentimentLabel = "positive" | "neutral" | "negative";

export interface Thread {
  id: string;
  productId: string;
  source: Exclude<SourceKind, "learn">;
  board: string;
  url: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  score: number | null;
  commentCount: number | null;
  sentimentLabel: SentimentLabel | null;
  sentimentScore: number | null;
  issueTags: string[];
  summary: string | null;
}

export interface Citation {
  n: number;
  source: SourceKind;
  title: string;
  url: string;
  snippet: string;
  date?: string;
  score?: number | null;
}

export interface IssueCluster {
  title: string;
  description: string;
  count: number;
  threadIds: string[];
  latestAt: string;
  latestUrl: string;
}

export interface SentimentBucket {
  day: string;
  avg: number;
  count: number;
}

export interface ProductOverview {
  productId: string;
  sentiment: {
    avg: number | null;
    label: SentimentLabel | null;
    positive: number;
    neutral: number;
    negative: number;
    analyzed: number;
    trend: SentimentBucket[];
  };
  issues: IssueCluster[];
  topReddit: Thread[];
  latestThreads: Thread[];
  sync: { source: string; lastFinishedAt: string | null; status: string | null; error: string | null }[];
  counts: { techcommunity: number; reddit: number };
}
