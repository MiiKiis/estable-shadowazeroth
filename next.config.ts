import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['ssh2'],
  images: {
    localPatterns: [
      {
        pathname: '/**',
        search: '',
      },
    ],
  },
  // Turbopack config (used with `next dev --turbo`)
  experimental: {
    turbo: {
      resolveAlias: {
        // Tell Turbopack to ignore these Node.js built-ins on the client side
        fs: { browser: false },
        net: { browser: false },
        tls: { browser: false },
        child_process: { browser: false },
      },
    },
  },
  // Webpack config (used with `next build` and `next dev` without --turbo)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
