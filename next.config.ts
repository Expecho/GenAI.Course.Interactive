import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // esbuild and node:worker_threads are used in the /api/run route. Keep them
  // as runtime dependencies on the server rather than bundling them.
  serverExternalPackages: ["esbuild", "@azure/data-tables"],
};

export default nextConfig;
