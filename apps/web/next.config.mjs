/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS/TSX; Next must transpile them.
  transpilePackages: ["@aix/core", "@aix/db"],
  eslint: { ignoreDuringBuilds: true },
  // better-sqlite3 is a native addon. It ends up bundled anyway (imported via a
  // transpilePackages workspace pkg), so at runtime its `bindings` loader looks
  // for the .node relative to .next — the Dockerfile drops the Node-ABI binary
  // into .next/build/Release/ to satisfy that lookup.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
