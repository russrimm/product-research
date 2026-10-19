import { ingestAll } from "../src/lib/ingest/run";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional file
  }
}

const ids = process.argv.slice(2);
ingestAll(ids.length ? ids : undefined)
  .then((summaries) => {
    console.log(JSON.stringify(summaries, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
