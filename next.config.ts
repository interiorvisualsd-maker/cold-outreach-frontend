import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't use standalone output on Vercel — Vercel handles this automatically
  // output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
