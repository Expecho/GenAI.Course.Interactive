import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // esbuild and node:worker_threads are used in the /api/run route. Keep them
  // as runtime dependencies on the server rather than bundling them.
  // applicationinsights monkey-patches core modules via require-in-the-middle;
  // bundling it silently stops that patching from working.
  serverExternalPackages: ["esbuild", "@azure/data-tables", "applicationinsights"],
};

export default nextConfig;
