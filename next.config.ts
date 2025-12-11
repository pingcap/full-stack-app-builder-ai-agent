import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  outputFileTracingIncludes: {
    "": ["./src/migrations/*.ts"],
  },
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
