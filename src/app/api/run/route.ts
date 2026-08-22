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
import { trackApiCall, trackException, trackRunFailure } from "@/lib/telemetry";

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
  // Check the email, not just the session: in a production build `auth()`
  // resolves to a truthy object for an unauthenticated caller, so a bare
  // `!session` check lets anonymous requests execute code against Foundry.
  // (Same guard as /api/progress.)
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  // No Auth.js adapter or session callback, so session.user.id is always
  // undefined — email is the only stable identifier for a participant.
  const email = session.user.email;

  let code: string;
  let topicId: string | null = null;
  let block: "main" | "followUp" | null = null;
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
    topicId = typeof body?.topicId === "string" ? body.topicId : null;
    block = body?.block === "main" || body?.block === "followUp" ? body.block : null;
  } catch (err) {
    trackException(err, {
      source: "api/run",
      phase: "request",
      reason: "invalid-json",
      email: email ?? "unknown",
    });
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!code.trim()) {
    trackRunFailure({ email, topicId, block, phase: "request", message: "No code provided" });
    return new Response("No code provided", { status: 400 });
  }

  let creds: FoundryCreds;
  try {
    creds = readCreds();
  } catch (err) {
    const message = (err as Error).message;
    trackRunFailure({
      email,
      topicId,
      block,
      phase: "config",
      message,
      detail: { phase: "runtime", name: (err as Error).name, stack: (err as Error).stack },
    });
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
      // Every failure — compile, runtime, Azure API, timeout, worker crash —
      // reaches the participant through this one callback, so it's also the
      // one place that needs to report. What gets streamed is unchanged.
      const enqueue = (event: SandboxEvent) => {
        // Telemetry-only: the participant already sees the call's result, and
        // the timings are for the host. Never forwarded to the browser.
        if (event.type === "apiCall") {
          trackApiCall(event, { email, topicId, block });
          return;
        }
        if (event.type === "error") {
          trackRunFailure({
            email,
            topicId,
            block,
            phase: event.detail?.phase ?? "runtime",
            message: event.message,
            code,
            detail: event.detail,
          });
          // The diagnostics are for telemetry only — stripping them keeps
          // stack traces and server paths out of the browser, and keeps the
          // wire format identical to what the client already expects.
          const { detail: _detail, ...clientEvent } = event;
          controller.enqueue(encoder.encode(toSse(clientEvent)));
          return;
        }
        controller.enqueue(encoder.encode(toSse(event)));
      };
      try {
        await runSandbox(code, creds, enqueue);
      } catch (err) {
        enqueue({
          type: "error",
          message: (err as Error).message,
          detail: { phase: "runtime", name: (err as Error).name, stack: (err as Error).stack },
        });
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
