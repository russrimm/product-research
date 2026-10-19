"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "error">("idle");

  async function run() {
    setState("running");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: [productId] }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <button
      onClick={run}
      disabled={state === "running"}
      className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50"
    >
      {state === "running" ? "Syncing…" : state === "error" ? "Sync failed — retry" : "Sync now"}
    </button>
  );
}
