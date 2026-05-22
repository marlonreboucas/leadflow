/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@leadflow/shared'],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
};
module.exports = nextConfig;
