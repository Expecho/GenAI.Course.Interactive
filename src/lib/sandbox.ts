import "server-only";
import { Worker } from "node:worker_threads";
import { transform } from "esbuild";
import { WORKER_SOURCE } from "./sandboxWorker";

export type SandboxEvent =
  | { type: "log"; line: string; stream?: "out" | "error" }
  | { type: "delta"; text: string }
  | { type: "image"; dataUrl: string }
  | { type: "result"; text: string; answer?: string }
  | { type: "error"; message: string }
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
    onEvent({ type: "error", message: `Compile error: ${(err as Error).message}` });
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
      });
      finish();
    }, TIMEOUT_MS);

    worker.on("message", (msg: SandboxEvent) => {
      onEvent(msg);
      if (msg.type === "done" || msg.type === "error") finish();
    });
    worker.on("error", (err) => {
      onEvent({ type: "error", message: err.message });
      finish();
    });
    worker.on("exit", () => finish());
  });
}
