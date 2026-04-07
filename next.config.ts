import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['ssh2'],
  turbopack: {},
  images: {
    localPatterns: [
      {
        pathname: '/**',
        search: '',
      },
    ],
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
