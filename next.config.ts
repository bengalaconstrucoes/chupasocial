import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
