import "server-only";
import { OpenAI } from "openai";

/**
 * Builds the server-side client for Azure AI Foundry from environment variables.
 *
 * Foundry exposes an OpenAI-compatible **v1 API**: use the plain `OpenAI` client
 * with `baseURL` pointing at `<endpoint>/openai/v1/`. No api-version is required
 * (omitting it routes to the latest GA), and the deployment name is passed as the
 * per-call `model` field rather than baked into the client.
 *
 * This module is `server-only`: importing it from client code is a build error,
 * which keeps the API key from ever being bundled into the browser.
 *
 * The returned client is injected into the sandbox so edited code can *call* it
 * without ever seeing the key string (the key lives only in this host process).
 */
function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.local.example to .env.local and fill in your Azure AI Foundry values.`,
    );
  }
  return value;
}

export function getDeployment(): string {
  return readEnv("AZURE_OPENAI_DEPLOYMENT");
}

/** Embeddings deployment for the RAG topic. Defaults to a known-deployed model. */
export function getEmbeddingDeployment(): string {
  return process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "text-embedding-3-large";
}

/** Image-generation deployment. Must be deployed in the Foundry resource. */
export function getImageDeployment(): string {
  return process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT ?? "gpt-image-1";
}

/** Reasoning-model deployment for the reasoning topic. Defaults to gpt-5. */
export function getReasoningDeployment(): string {
  return process.env.AZURE_OPENAI_REASONING_DEPLOYMENT ?? "gpt-5";
}

/**
 * Turns any Foundry endpoint into the v1 API base URL. The v1 chat-completions
 * route lives at `<resource-host>/openai/v1/`, so we reduce the endpoint to its
 * origin (dropping a `/api/projects/<project>` path if the user pasted the
 * project endpoint) and append the route.
 */
export function toV1BaseURL(endpoint: string): string {
  let origin: string;
  try {
    origin = new URL(endpoint).origin;
  } catch {
    // Fall back to a trailing-slash trim if it isn't a full URL.
    origin = endpoint.replace(/\/+$/, "");
  }
  return `${origin}/openai/v1/`;
}

export function createClient(): OpenAI {
  const endpoint = readEnv("AZURE_AI_FOUNDRY_ENDPOINT");
  const apiKey = readEnv("AZURE_OPENAI_API_KEY");
  readEnv("AZURE_OPENAI_DEPLOYMENT"); // validate it's set; used as the per-call model

  return new OpenAI({
    baseURL: toV1BaseURL(endpoint),
    apiKey,
  });
}
