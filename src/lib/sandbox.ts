import "server-only";
import { Worker } from "node:worker_threads";
import { transform } from "esbuild";
import { WORKER_SOURCE } from "./sandboxWorker";

/**
 * Diagnostics attached to an error event. Never shown to the participant — it
 * exists so /api/run can report what actually broke to Application Insights.
 */
export type SandboxErrorDetail = {
  phase: "compile" | "runtime" | "api" | "timeout" | "worker";
  name?: string;
  stack?: string;
  /** HTTP status from Azure OpenAI. */
  status?: number;
  code?: string;
  errType?: string;
  /** The request id Azure support asks for. */
  requestId?: string;
  /** Worker exit code, when the worker died on its own. */
  exitCode?: number;
  /** "line:column" in the participant's code, for compile errors. */
  location?: string;
};

/**
 * One HTTP call the participant's code made to Azure AI Foundry. Reported by
 * the worker, consumed by /api/run for telemetry — never sent to the browser.
 */
export type SandboxApiCall = {
  type: "apiCall";
  /** URL path only, e.g. "/openai/v1/responses" — never the full URL or key. */
  path?: string;
  method: string;
  /** Model named in the request body, when there was one. */
  model?: string;
  status?: number;
  durationMs: number;
  success: boolean;
  streaming?: boolean;
  requestId?: string;
  /** Transport-level failure message, when the request never got a response. */
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type SandboxEvent =
  | { type: "log"; line: string; stream?: "out" | "error" }
  | SandboxApiCall
  | { type: "delta"; text: string }
  | { type: "image"; dataUrl: string }
  | { type: "result"; text: string; answer?: string }
  | { type: "error"; message: string; detail?: SandboxErrorDetail }
  | { type: "done" };

export type FoundryCreds = {
  baseURL: string;
  apiKey: string;
  deployment: string;
  embeddingDeployment: string;
  imageDeployment: string;
  reasoningDeployment: string;
};

// 60s so slower calls (image generation, high-effort reasoning) can finish;
// still bounded so a runaway edit can't hang the server indefinitely.
const TIMEOUT_MS = 60_000;

/**
 * Transpiles the edited TypeScript to JS (esbuild), then runs it inside a
 * node:vm context in a worker_thread with a hard timeout. Output is delivered
 * incrementally via `onEvent` so callers can stream it to the browser.
 *
 * The worker is killed if it exceeds the timeout, so a runaway edit
 * (e.g. `while (true) {}`) cannot hang the server.
 */
export async function runSandbox(
  tsCode: string,
  creds: FoundryCreds,
  onEvent: (e: SandboxEvent) => void,
): Promise<void> {
  let js: string;
  try {
    // Wrap before transpiling so the user code can use top-level `await` AND
    // top-level `return` (esbuild rejects a bare top-level return otherwise).
    const wrapped = `(async () => {\n${tsCode}\n})()`;
    const out = await transform(wrapped, { loader: "ts", target: "es2022" });
    js = out.code;
  } catch (err) {
    const e = err as Error & {
      errors?: { text: string; location?: { line: number; column: number } }[];
    };
    const loc = e.errors?.[0]?.location;
    onEvent({
      type: "error",
      message: `Compile error: ${e.message}`,
      detail: {
        phase: "compile",
        name: e.name,
        stack: e.stack,
        // esbuild counts the async-IIFE wrapper line added above, so subtract
        // one to get back to the line the participant actually edited.
        location: loc ? `${loc.line - 1}:${loc.column}` : undefined,
      },
    });
    return;
  }

  await new Promise<void>((resolve) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { code: js, creds },
    });

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve();
    };

    const timer = setTimeout(() => {
      onEvent({
        type: "error",
        message: `Execution timed out after ${TIMEOUT_MS / 1000}s and was terminated.`,
        detail: { phase: "timeout" },
      });
      finish();
    }, TIMEOUT_MS);

    worker.on("message", (msg: SandboxEvent) => {
      onEvent(msg);
      if (msg.type === "done" || msg.type === "error") finish();
    });
    worker.on("error", (err) => {
      onEvent({
        type: "error",
        message: err.message,
        detail: { phase: "worker", name: err.name, stack: err.stack },
      });
      finish();
    });
    worker.on("exit", (exitCode) => {
      // On the happy path finish() already ran and terminated the worker, which
      // itself produces a non-zero code — so only report an unsettled exit.
      if (!settled && exitCode !== 0) {
        onEvent({
          type: "error",
          message: `The sandbox process exited unexpectedly (code ${exitCode}).`,
          detail: { phase: "worker", exitCode },
        });
      }
      finish();
    });
  });
}
