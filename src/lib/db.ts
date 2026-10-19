import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "@/lib/env";
import type { SentimentLabel, Thread } from "@/lib/types";

type Row = Record<string, unknown>;

const globalForDb = globalThis as unknown as { __db?: DatabaseSync; __fts?: boolean };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  source TEXT NOT NULL,
  board TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  score INTEGER,
  comment_count INTEGER,
  sentiment_label TEXT,
  sentiment_score REAL,
  issue_tags TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  embedding TEXT,
  fetched_at TEXT NOT NULL,
  analyzed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_threads_product_created ON threads(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_source ON threads(product_id, source);
CREATE TABLE IF NOT EXISTS ingest_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  product_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  fetched INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE TABLE IF NOT EXISTS insights (
  product_id TEXT PRIMARY KEY,
  issues_json TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
`;

export function getDb(): DatabaseSync {
  if (globalForDb.__db) return globalForDb.__db;
  const path = resolve(/* turbopackIgnore: true */ process.cwd(), env.databasePath);
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  try {
    db.exec(
      "CREATE VIRTUAL TABLE IF NOT EXISTS threads_fts USING fts5(title, body, content='threads', content_rowid='rowid', tokenize='porter unicode61');",
    );
    globalForDb.__fts = true;
  } catch {
    globalForDb.__fts = false;
  }
  globalForDb.__db = db;
  return db;
}

export function hasFts(): boolean {
  getDb();
  return Boolean(globalForDb.__fts);
}

function mapThread(r: Row): Thread {
  return {
    id: r.id as string,
    productId: r.product_id as string,
    source: r.source as Thread["source"],
    board: r.board as string,
    url: r.url as string,
    title: r.title as string,
    body: r.body as string,
    author: r.author as string,
    createdAt: r.created_at as string,
    score: (r.score as number | null) ?? null,
    commentCount: (r.comment_count as number | null) ?? null,
    sentimentLabel: (r.sentiment_label as SentimentLabel | null) ?? null,
    sentimentScore: (r.sentiment_score as number | null) ?? null,
    issueTags: JSON.parse((r.issue_tags as string) || "[]"),
    summary: (r.summary as string | null) ?? null,
  };
}

export interface ThreadInput {
  id: string;
  productId: string;
  source: Thread["source"];
  board: string;
  url: string;
  title: string;
  body: string;
  author: string;
  createdAt: string;
  score: number | null;
  commentCount: number | null;
}

/** Inserts or refreshes a thread. Returns true when content changed and sentiment must be recomputed. */
export function upsertThread(t: ThreadInput): boolean {
  const db = getDb();
  const existing = db.prepare("SELECT rowid, title, body FROM threads WHERE id = ?").get(t.id) as
    | { rowid: number; title: string; body: string }
    | undefined;
  const now = new Date().toISOString();
  if (!existing) {
    const res = db
      .prepare(
        `INSERT INTO threads (id, product_id, source, board, url, title, body, author, created_at, score, comment_count, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(t.id, t.productId, t.source, t.board, t.url, t.title, t.body, t.author, t.createdAt, t.score, t.commentCount, now);
    if (hasFts()) {
      db.prepare("INSERT INTO threads_fts(rowid, title, body) VALUES (?, ?, ?)").run(res.lastInsertRowid, t.title, t.body);
    }
    return true;
  }
  const changed = existing.title !== t.title || existing.body !== t.body;
  db.prepare("UPDATE threads SET score = ?, comment_count = ?, fetched_at = ? WHERE id = ?").run(
    t.score,
    t.commentCount,
    now,
    t.id,
  );
  if (changed) {
    if (hasFts()) {
      db.prepare("INSERT INTO threads_fts(threads_fts, rowid, title, body) VALUES ('delete', ?, ?, ?)").run(
        existing.rowid,
        existing.title,
        existing.body,
      );
      db.prepare("INSERT INTO threads_fts(rowid, title, body) VALUES (?, ?, ?)").run(existing.rowid, t.title, t.body);
    }
    db.prepare(
      "UPDATE threads SET title = ?, body = ?, analyzed_at = NULL, embedding = NULL WHERE id = ?",
    ).run(t.title, t.body, t.id);
  }
  return changed;
}

export function listNeedingAnalysis(limit: number): Thread[] {
  const rows = getDb()
    .prepare("SELECT * FROM threads WHERE analyzed_at IS NULL ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Row[];
  return rows.map(mapThread);
}

export function setAnalysis(
  id: string,
  label: SentimentLabel,
  score: number,
  tags: string[],
  summary: string | null,
): void {
  getDb()
    .prepare(
      "UPDATE threads SET sentiment_label = ?, sentiment_score = ?, issue_tags = ?, summary = ?, analyzed_at = ? WHERE id = ?",
    )
    .run(label, score, JSON.stringify(tags), summary, new Date().toISOString(), id);
}

export function listNeedingEmbedding(limit: number): Thread[] {
  const rows = getDb()
    .prepare("SELECT * FROM threads WHERE embedding IS NULL ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Row[];
  return rows.map(mapThread);
}

export function setEmbedding(id: string, vector: number[]): void {
  getDb().prepare("UPDATE threads SET embedding = ? WHERE id = ?").run(JSON.stringify(vector), id);
}

export function getThreadsByIds(ids: string[]): Thread[] {
  if (ids.length === 0) return [];
  const marks = ids.map(() => "?").join(",");
  const rows = getDb().prepare(`SELECT * FROM threads WHERE id IN (${marks})`).all(...ids) as Row[];
  return rows.map(mapThread);
}

export function searchKeyword(query: string, productId: string | null, limit: number): Thread[] {
  const db = getDb();
  const terms = (query.toLowerCase().match(/[a-z0-9][a-z0-9_-]{1,}/g) ?? []).slice(0, 12);
  if (terms.length === 0) return [];
  const productClause = productId ? "AND t.product_id = ?" : "";
  const params: (string | number)[] = [];
  if (hasFts()) {
    const match = terms.map((t) => `"${t}"`).join(" OR ");
    params.push(match);
    if (productId) params.push(productId);
    params.push(limit);
    const rows = db
      .prepare(
        `SELECT t.* FROM threads_fts f JOIN threads t ON t.rowid = f.rowid
         WHERE threads_fts MATCH ? ${productClause}
         ORDER BY bm25(threads_fts, 4.0, 1.0) LIMIT ?`,
      )
      .all(...params) as Row[];
    return rows.map(mapThread);
  }
  const like = terms.map(() => "(LOWER(t.title) LIKE ? OR LOWER(t.body) LIKE ?)").join(" OR ");
  for (const term of terms) params.push(`%${term}%`, `%${term}%`);
  if (productId) params.push(productId);
  params.push(limit);
  const rows = db
    .prepare(`SELECT t.* FROM threads t WHERE (${like}) ${productClause} ORDER BY t.created_at DESC LIMIT ?`)
    .all(...params) as Row[];
  return rows.map(mapThread);
}

export function listEmbeddings(productId: string | null): { id: string; vector: number[] }[] {
  const rows = (
    productId
      ? getDb().prepare("SELECT id, embedding FROM threads WHERE embedding IS NOT NULL AND product_id = ?").all(productId)
      : getDb().prepare("SELECT id, embedding FROM threads WHERE embedding IS NOT NULL").all()
  ) as Row[];
  return rows.map((r) => ({ id: r.id as string, vector: JSON.parse(r.embedding as string) as number[] }));
}

export function listRecentThreads(productId: string, limit: number, sinceIso?: string): Thread[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM threads WHERE product_id = ? ${sinceIso ? "AND created_at >= ?" : ""} ORDER BY created_at DESC LIMIT ?`,
    )
    .all(...(sinceIso ? [productId, sinceIso, limit] : [productId, limit])) as Row[];
  return rows.map(mapThread);
}

export function listTopRedditThreads(productId: string, limit: number): Thread[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM threads WHERE product_id = ? AND source = 'reddit' ORDER BY COALESCE(score, 0) DESC, created_at DESC LIMIT ?",
    )
    .all(productId, limit) as Row[];
  return rows.map(mapThread);
}

export function countBySource(productId: string): { techcommunity: number; reddit: number } {
  const rows = getDb()
    .prepare("SELECT source, COUNT(*) c FROM threads WHERE product_id = ? GROUP BY source")
    .all(productId) as { source: string; c: number }[];
  const out = { techcommunity: 0, reddit: 0 };
  for (const r of rows) if (r.source === "techcommunity" || r.source === "reddit") out[r.source] = r.c;
  return out;
}

export function startRun(source: string, productId: string): number {
  const res = getDb()
    .prepare("INSERT INTO ingest_runs (source, product_id, started_at, status) VALUES (?, ?, ?, 'running')")
    .run(source, productId, new Date().toISOString());
  return Number(res.lastInsertRowid);
}

export function finishRun(id: number, status: "ok" | "error" | "skipped", fetched: number, error?: string): void {
  getDb()
    .prepare("UPDATE ingest_runs SET finished_at = ?, status = ?, fetched = ?, error = ? WHERE id = ?")
    .run(new Date().toISOString(), status, fetched, error ?? null, id);
}

export function lastRunBySource(productId: string): {
  source: string;
  lastFinishedAt: string | null;
  status: string | null;
  error: string | null;
}[] {
  const rows = getDb()
    .prepare(
      `SELECT source, finished_at, status, error FROM ingest_runs
       WHERE id IN (SELECT MAX(id) FROM ingest_runs WHERE product_id = ? GROUP BY source)`,
    )
    .all(productId) as Row[];
  return rows.map((r) => ({
    source: r.source as string,
    lastFinishedAt: (r.finished_at as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    error: (r.error as string | null) ?? null,
  }));
}

export function saveInsights(productId: string, issuesJson: string): void {
  getDb()
    .prepare(
      "INSERT INTO insights (product_id, issues_json, computed_at) VALUES (?, ?, ?) ON CONFLICT(product_id) DO UPDATE SET issues_json = excluded.issues_json, computed_at = excluded.computed_at",
    )
    .run(productId, issuesJson, new Date().toISOString());
}

export function loadInsights(productId: string): { issuesJson: string; computedAt: string } | null {
  const r = getDb().prepare("SELECT issues_json, computed_at FROM insights WHERE product_id = ?").get(productId) as
    | Row
    | undefined;
  return r ? { issuesJson: r.issues_json as string, computedAt: r.computed_at as string } : null;
}
