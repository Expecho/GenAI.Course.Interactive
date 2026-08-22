import type { Instrumentation } from "next";

/**
 * Next.js runs this once per server process, before any route is handled.
 *
 * `process.env.NEXT_RUNTIME` is inlined at build time, so the *block* form
 * below lets webpack drop this branch — and the whole Application Insights
 * dependency — from the Edge middleware bundle. Do not refactor it into an
 * early return: that defeats the dead-code elimination and breaks the build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}

/**
 * Catches errors Next itself surfaces — including server components with no
 * error boundary, e.g. the unguarded storage read in app/admin/page.tsx.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { trackException } = await import("@/lib/telemetry");
    trackException(err, {
      source: "next.onRequestError",
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    });
  }
};
