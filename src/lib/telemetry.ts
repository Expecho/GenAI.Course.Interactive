import "server-only";
import type { SandboxApiCall, SandboxErrorDetail } from "./sandbox";

/**
 * Application Insights reporting. Everything here is fire-and-forget and
 * swallow-and-continue: a telemetry failure must never break a workshop run.
 *
 * The SDK itself is started once in ../instrumentation.node.ts. When
 * APPLICATIONINSIGHTS_CONNECTION_STRING is unset (local dev, `next build`) the
 * SDK is never initialised and every helper below is a no-op.
 */

const PREFIX = "[telemetry]";

/** App Insights caps one custom dimension at 8192 chars — stay well under. */
const MAX_CODE_CHARS = 4000;
const MAX_STACK_CHARS = 4000;

export type RunErrorPhase =
  | "compile"
  | "runtime"
  | "api"
  | "timeout"
  | "worker"
  | "config"
  | "request";

export type TelemetryProps = Record<string, string | number | boolean | null | undefined>;

type DefaultClient = (typeof import("applicationinsights"))["defaultClient"];

let clientPromise: Promise<DefaultClient | null> | null = null;

/**
 * Loaded lazily (and memoised) at runtime. `webpackIgnore` is what makes this
 * safe: without it the bundler follows the import and drags the SDK's ~25
 * OpenTelemetry packages — and their node:fs / node:https imports — into every
 * bundle that can reach this module, including the Edge middleware bundle via
 * auth.ts -> tableStorage.ts. The import stays a native one, resolved from
 * node_modules at call time.
 */
function getClient(): Promise<DefaultClient | null> {
  if (!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) return Promise.resolve(null);
  clientPromise ??= import(/* webpackIgnore: true */ "applicationinsights")
    .then((m) => m.defaultClient ?? null)
    .catch((err) => {
      console.error(`${PREFIX} failed to load applicationinsights:`, err);
      return null;
    });
  return clientPromise;
}

/** Drops empty values and stringifies the rest — OpenTelemetry rejects non-scalars. */
function clean(props: TelemetryProps): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
}

/** Reports an exception. Never throws, never rejects. */
export function trackException(err: unknown, props: TelemetryProps = {}): void {
  void getClient()
    .then((client) => {
      if (!client) return;
      const exception = err instanceof Error ? err : new Error(String(err));
      client.trackException({ exception, properties: clean(props) });
    })
    .catch((e) => console.error(`${PREFIX} trackException failed:`, e));
}

/** Reports a custom event — for signals that aren't exceptions. Never throws. */
export function trackEvent(name: string, props: TelemetryProps = {}): void {
  void getClient()
    .then((client) => {
      if (!client) return;
      client.trackEvent({ name, properties: clean(props) });
    })
    .catch((e) => console.error(`${PREFIX} trackEvent failed:`, e));
}

export type RunFailure = {
  email?: string | null;
  topicId?: string | null;
  block?: "main" | "followUp" | null;
  phase: RunErrorPhase;
  message: string;
  /** The participant's submitted code, truncated before it leaves this module. */
  code?: string;
  detail?: SandboxErrorDetail;
};

/**
 * The single reporting point for every participant-visible failure on /api/run.
 *
 * NEVER pass FoundryCreds or anything derived from AZURE_OPENAI_API_KEY here —
 * this function takes only the fields above precisely so the key can't leak
 * into telemetry.
 */
export function trackRunFailure(f: RunFailure): void {
  const d = f.detail;

  // The exception *name* is what groups rows in the portal's Failures blade.
  // Always use the phase — the underlying error is almost always a plain
  // "Error", which would collapse every failure into one useless bucket. The
  // original name is kept as a dimension instead.
  const exception = new Error(f.message);
  exception.name = `SandboxError:${f.phase}`;
  if (d?.stack) exception.stack = d.stack.slice(0, MAX_STACK_CHARS);

  trackException(exception, {
    source: "api/run",
    email: f.email ?? "unknown",
    topicId: f.topicId ?? "unknown",
    block: f.block ?? "unknown",
    phase: f.phase,
    errorName: d?.name,
    httpStatus: d?.status,
    errorCode: d?.code,
    errorType: d?.errType,
    requestId: d?.requestId,
    exitCode: d?.exitCode,
    location: d?.location,
    submittedCode: f.code?.slice(0, MAX_CODE_CHARS),
    codeTruncated: f.code !== undefined && f.code.length > MAX_CODE_CHARS,
  });
}

/**
 * Reports one Azure AI Foundry call made by a participant's code as a
 * dependency, so /api/run shows its downstream calls the way /api/grade already
 * does. The worker thread it runs on isn't auto-instrumented, so these arrive
 * over postMessage instead of being collected from the HTTP client.
 *
 * Takes the same care as trackRunFailure: the URL path and response metadata
 * only, never FoundryCreds or anything derived from AZURE_OPENAI_API_KEY.
 */
export function trackApiCall(
  call: SandboxApiCall,
  ctx: { email?: string | null; topicId?: string | null; block?: "main" | "followUp" | null },
): void {
  void getClient()
    .then((client) => {
      if (!client) return;
      client.trackDependency({
        name: `${call.method} ${call.path ?? "unknown"}`,
        data: call.path ?? "unknown",
        target: "Azure AI Foundry",
        dependencyTypeName: "HTTP",
        duration: call.durationMs,
        resultCode: call.status ?? 0,
        success: call.success,
        properties: clean({
          source: "sandbox",
          email: ctx.email ?? "unknown",
          topicId: ctx.topicId ?? "unknown",
          block: ctx.block ?? "unknown",
          model: call.model,
          streaming: call.streaming,
          requestId: call.requestId,
          error: call.error,
          inputTokens: call.inputTokens,
          outputTokens: call.outputTokens,
          totalTokens: call.totalTokens,
        }),
      });
    })
    .catch((e) => console.error(`${PREFIX} trackApiCall failed:`, e));
}
