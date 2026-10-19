# Product Research

Ask questions about Microsoft Foundry, Copilot Studio, Microsoft Copilot and Driving Adoption. Answers are grounded in Microsoft Learn (live via the Learn MCP server), Microsoft Tech Community forums and product subreddits, with citations. Each product dashboard shows overall sentiment, a 30-day sentiment trend, recurring issues, the latest threads and top Reddit posts by upvotes.

## Quick start

```powershell
npm install
Copy-Item .env.example .env.local   # then edit
npm run ingest                      # pulls Tech Community (and Reddit, if configured)
npm run dev
```

Open http://localhost:3000.

Without Azure OpenAI credentials the app still works: sentiment and topics use a built-in lexicon, and answers are extractive (top cited sources). Add credentials for LLM sentiment, embeddings (hybrid retrieval) and synthesized streaming answers.

## Configuration (`.env.local`)

| Variable | Purpose |
| --- | --- |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` | Azure OpenAI / Foundry resource |
| `AZURE_OPENAI_CHAT_DEPLOYMENT`, `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | Deployment names |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | Reddit OAuth (app-only) |
| `LEARN_MCP_URL` | Defaults to `https://learn.microsoft.com/api/mcp` |
| `DATABASE_PATH` | SQLite file, default `data/research.db` |
| `INGEST_TOKEN` | Bearer token required by `POST /api/ingest` in production |

See `.env.example` for the complete list, including scheduler settings.

### Reddit credentials

Create a "script" or "web app" at https://www.reddit.com/prefs/apps and copy the client ID and secret. Reddit blocks unauthenticated API access, so Reddit ingestion is skipped until these are set.

Subreddits are configured in `src/config/products.ts`. `CopilotStudio` and `AzureFoundry` were provided by the requirements; others (`microsoft_365_copilot`, `copilotmicrosoft`) are unverified guesses. Missing or private subreddits are skipped without failing the run.

## Ingestion

- CLI: `npm run ingest`
- HTTP: `curl -X POST http://localhost:3000/api/ingest -H "Authorization: Bearer $INGEST_TOKEN"`
- Scheduled: the in-process scheduler starts with the server (see scheduler variables in `.env.example`).

Tech Community has no usable public API, so the app reads the public Khoros RSS feeds (`/t5/s/gxcuf89792/rss/board?board.id=<id>`), which return about 20 recent threads per board without kudos or reply counts. Only forum threads are kept. Please respect the site's terms and keep the schedule modest.

## API

- `POST /api/ask` with `{ "question": "...", "productId": "copilot-studio" }` streams NDJSON events (citations, then answer tokens).
- `GET /api/products/{id}/overview` returns sentiment, trend, issues and top posts.

## Scripts

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Docker and Azure

```powershell
docker build -t product-research .
docker run -p 3000:3000 -v pr-data:/data --env-file .env.local product-research
```

For Azure, deploy the image to Azure Container Apps and mount an Azure Files share at `/data` for SQLite. Use a managed identity or Key Vault references for secrets. SQLite is single-writer, so keep one replica; moving to Postgres is the path to scale out.
