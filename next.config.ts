import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SQL migrations are applied at runtime on first request (see src/db/ensure-schema.ts).
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
};

export default nextConfig;
