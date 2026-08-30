import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Issue #755: shared monorepo packages ship raw TS source, so Next.js
  // needs to be told to transpile them like any other app source file.
  transpilePackages: ["@agrocylo/wallet-core"],
};

export default nextConfig;
