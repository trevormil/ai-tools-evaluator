/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fully static export (ADR-0004) — the app reads the git corpus at build time
  // and ships a static `out/` directory to Cloudflare Pages. No server, no DB.
  output: "export",
  images: { unoptimized: true },
  // Workspace packages ship raw TS/TSX; Next must transpile them.
  transpilePackages: ["@aix/core", "@aix/db"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
