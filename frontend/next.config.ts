import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://gateway:3001/api/:path*',
      },
    ];
  },
  // プロキシのタイムアウトを延長
  experimental: {
    proxyTimeout: 120000, // 120秒
  },
};

export default nextConfig;
