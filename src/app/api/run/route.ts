import { NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  createClient,
  getDeployment,
  getEmbeddingDeployment,
  getImageDeployment,
  getReasoningDeployment,
  toV1BaseURL,
} from "@/lib/azureClient";
import { runSandbox, type FoundryCreds, type SandboxEvent } from "@/lib/sandbox";

// The sandbox uses node:worker_threads + esbuild, so this must run on Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCreds(): FoundryCreds {
  createClient();
  return {
    baseURL: toV1BaseURL(process.env.AZURE_AI_FOUNDRY_ENDPOINT!),
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    deployment: getDeployment(),
    embeddingDeployment: getEmbeddingDeployment(),
    imageDeployment: getImageDeployment(),
    reasoningDeployment: getReasoningDeployment(),
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  let code: string;
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!code.trim()) {
    return new Response("No code provided", { status: 400 });
  }

  let creds: FoundryCreds;
  try {
    creds = readCreds();
  } catch (err) {
    const message = (err as Error).message;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(sse({ type: "error", message }));
        controller.close();
      },
    });
    return sseResponse(stream);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: SandboxEvent) => {
        controller.enqueue(encoder.encode(toSse(event)));
      };
      try {
        await runSandbox(code, creds, enqueue);
      } catch (err) {
        enqueue({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}

function toSse(event: SandboxEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function sse(event: SandboxEvent): Uint8Array {
  return new TextEncoder().encode(toSse(event));
}

function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
