import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for small Docker images (~50 MB instead of ~500 MB).
  // The `next start` server gets a self-contained dist with only required deps.
  output: "standalone",
};

export default nextConfig;
