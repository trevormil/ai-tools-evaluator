/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS/TSX; Next must transpile them.
  transpilePackages: ["@aix/core", "@aix/db"],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    // bun:sqlite is a Bun runtime builtin — never bundle it. Keep it external so
    // the server bundle emits a bare require() resolved by the Bun runtime.
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({ "bun:sqlite": "commonjs bun:sqlite" });
    } else {
      // Belt-and-suspenders: if DB code ever leaks into a client bundle, fail
      // loudly at build rather than shipping it.
      config.resolve = config.resolve || {};
      config.resolve.fallback = { ...(config.resolve.fallback || {}), "bun:sqlite": false };
    }
    return config;
  },
};

export default nextConfig;
