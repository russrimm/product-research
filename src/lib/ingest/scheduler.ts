import { env } from "@/lib/env";
import { ingestAll } from "@/lib/ingest/run";

declare global {
  var __schedulerStarted: boolean | undefined;
}

export function startScheduler(): void {
  if (!env.schedulerEnabled || globalThis.__schedulerStarted) return;
  globalThis.__schedulerStarted = true;
  const tick = () =>
    ingestAll().catch((err) => console.error("Scheduled ingest failed:", err instanceof Error ? err.message : err));
  setTimeout(tick, 5_000).unref();
  setInterval(tick, env.ingestCronMinutes * 60_000).unref();
  console.log(`Internal ingest scheduler enabled (every ${env.ingestCronMinutes} min)`);
}
