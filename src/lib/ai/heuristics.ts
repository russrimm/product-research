import type { SentimentLabel } from "@/lib/types";

const POSITIVE = [
  "thanks", "thank you", "great", "love", "works", "working", "solved", "fixed", "helpful", "awesome",
  "excellent", "amazing", "impressed", "easy", "improved", "resolved", "perfect", "nice", "good",
];
const NEGATIVE = [
  "error", "fail", "failed", "failing", "broken", "bug", "issue", "problem", "cannot", "can't", "cant",
  "doesn't", "doesnt", "not working", "stuck", "crash", "slow", "timeout", "frustrat", "unable",
  "disappoint", "terrible", "worse", "regression", "outage", "deprecated", "blocked", "missing",
];

export const TOPIC_KEYWORDS: Record<string, string[]> = {
  "Authentication & permissions": ["auth", "permission", "403", "401", "sso", "token", "entra", "login", "sign in", "access denied"],
  "Licensing & billing": ["license", "licence", "billing", "pricing", "cost", "quota", "capacity", "credits"],
  "Connectors & integrations": ["connector", "sharepoint", "dataverse", "power automate", "api", "mcp", "integration", "teams"],
  "Deployment & publishing": ["deploy", "publish", "channel", "endpoint", "provision", "region"],
  "Performance & reliability": ["slow", "latency", "timeout", "outage", "crash", "throttl", "rate limit", "429"],
  "Models & responses": ["model", "hallucinat", "prompt", "response", "knowledge", "grounding", "rag", "token limit"],
  "Errors & bugs": ["error", "bug", "exception", "fails", "failed", "broken", "not working"],
  "Adoption & change management": ["adoption", "champion", "training", "rollout", "usage", "enablement"],
};

export function heuristicSentiment(text: string): { label: SentimentLabel; score: number } {
  const t = text.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE) if (t.includes(w)) pos++;
  for (const w of NEGATIVE) if (t.includes(w)) neg++;
  const total = pos + neg;
  const score = total === 0 ? 0 : Math.max(-1, Math.min(1, (pos - neg) / (total + 1)));
  const label: SentimentLabel = score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral";
  return { label, score: Math.round(score * 100) / 100 };
}

export function heuristicTags(text: string): string[] {
  const t = text.toLowerCase();
  return Object.entries(TOPIC_KEYWORDS)
    .filter(([, words]) => words.some((w) => t.includes(w)))
    .map(([tag]) => tag)
    .slice(0, 3);
}

export function labelForScore(score: number | null): SentimentLabel | null {
  if (score === null) return null;
  return score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral";
}
