import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  outputFileTracingIncludes: {
    "": ["./src/migrations/*.ts"],
  },
};

export default nextConfig;
