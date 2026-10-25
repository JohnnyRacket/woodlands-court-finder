import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Size build workers to available memory, so the image builds on small (2 GB) hosts.
  experimental: { memoryBasedWorkersCount: true },
  // Type-checking ArcGIS's large type definitions alongside the build needs > 2 GB, so the
  // Docker build skips it; `npm run typecheck` runs it locally and in CI.
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_TYPECHECK === "1" },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
