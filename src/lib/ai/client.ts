import { AzureOpenAI } from "openai";
import { env } from "@/lib/env";

let client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI {
  if (!client) {
    client = new AzureOpenAI({
      endpoint: env.azureEndpoint,
      apiKey: env.azureApiKey,
      apiVersion: env.azureApiVersion,
    });
  }
  return client;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatJson<T>(messages: ChatMessage[]): Promise<T> {
  const res = await getClient().chat.completions.create({
    model: env.chatDeployment,
    messages,
    response_format: { type: "json_object" },
    temperature: 0,
  });
  const text = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text) as T;
}

export async function* chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const stream = await getClient().chat.completions.create({
    model: env.chatDeployment,
    messages,
    stream: true,
    temperature: 0.2,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await getClient().embeddings.create({ model: env.embeddingDeployment, input: texts });
  return res.data.map((d) => d.embedding);
}
