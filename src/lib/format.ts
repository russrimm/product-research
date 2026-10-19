export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export function sentimentColor(label: string | null): string {
  if (label === "positive") return "text-pos";
  if (label === "negative") return "text-neg";
  return "text-neu";
}
