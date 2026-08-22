import * as appInsights from "applicationinsights";

const PREFIX = "[telemetry]";

const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (!conn) {
  // No connection string — local dev without a resource, and `next build`
  // inside the Docker builder stage. The SDK never starts and every helper in
  // lib/telemetry.ts is a no-op, so the app behaves exactly as it did before.
  console.warn(`${PREFIX} APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled`);
} else {
  try {
    // Only takes effect locally: in Container Apps the platform's resource
    // detector overrides service.name with CONTAINER_APP_NAME.
    process.env.OTEL_SERVICE_NAME ||= "genai-workshop";

    appInsights
      .setup(conn)
      .setAutoCollectRequests(true)
      // Outbound Azure OpenAI calls from /api/grade. This only covers the main
      // thread — the sandbox worker has its own unpatched module registry, so
      // participant calls are reported explicitly via telemetry.trackApiCall.
      .setAutoCollectDependencies(true)
      .setAutoCollectExceptions(true) // uncaughtException / unhandledRejection
      .setAutoCollectPerformance(false, false)
      .setAutoCollectPreAggregatedMetrics(false)
      .setAutoCollectConsole(false, false) // we report explicitly; avoids Next's log noise
      .setSendLiveMetrics(false)
      .setInternalLogging(false, true);

    // Everything below MUST precede start(): the SDK snapshots this config by
    // value during initialisation, so setting it afterwards silently does nothing.
    //
    // Sampling stays at 100% because the distro propagates a sampled-out trace
    // decision to its logs, which would drop exceptions. Workshop volume is tiny.
    appInsights.defaultClient.config.samplingPercentage = 100;
    if (process.env.BUILD_ID) {
      // Set by deploy.ps1 — stamps every item so you can tell whether a failure
      // survived the last deploy.
      appInsights.defaultClient.commonProperties = { buildId: process.env.BUILD_ID };
    }

    appInsights.start();

    // Container Apps sends SIGTERM when draining a revision — flush the batch.
    process.once("SIGTERM", () => {
      void appInsights.defaultClient.flush().catch(() => {});
    });

    console.log(`${PREFIX} Application Insights started`);
  } catch (err) {
    console.error(`${PREFIX} failed to start Application Insights:`, err);
  }
}
