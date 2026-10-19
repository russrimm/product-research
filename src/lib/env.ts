function read(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  get azureEndpoint() {
    return read("AZURE_OPENAI_ENDPOINT").replace(/\/+$/, "");
  },
  get azureApiKey() {
    return read("AZURE_OPENAI_API_KEY");
  },
  get azureApiVersion() {
    return read("AZURE_OPENAI_API_VERSION", "2025-04-01-preview");
  },
  get chatDeployment() {
    return read("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4.1");
  },
  get embeddingDeployment() {
    return read("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small");
  },
  get redditClientId() {
    return read("REDDIT_CLIENT_ID");
  },
  get redditClientSecret() {
    return read("REDDIT_CLIENT_SECRET");
  },
  get redditUserAgent() {
    return read("REDDIT_USER_AGENT", "product-research/0.1");
  },
  get learnMcpUrl() {
    return read("LEARN_MCP_URL", "https://learn.microsoft.com/api/mcp");
  },
  get databasePath() {
    return read("DATABASE_PATH", "./data/research.db");
  },
  get ingestToken() {
    return read("INGEST_TOKEN");
  },
  get schedulerEnabled() {
    return read("ENABLE_INTERNAL_SCHEDULER") === "true";
  },
  get ingestCronMinutes() {
    const n = Number(read("INGEST_CRON_MINUTES", "60"));
    return Number.isFinite(n) && n >= 1 ? n : 60;
  },
  get aiConfigured() {
    return Boolean(this.azureEndpoint && this.azureApiKey);
  },
  get redditConfigured() {
    return Boolean(this.redditClientId && this.redditClientSecret);
  },
};
