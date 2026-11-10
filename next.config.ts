import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The snapshot is read from disk by the GraphQL route and the root layout.
  outputFileTracingIncludes: { "/**": ["./data/snapshot.json"] },
};

export default nextConfig;
