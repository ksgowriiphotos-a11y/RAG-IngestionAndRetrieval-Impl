/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: true,
  },
  distDir: '.next',
  pageExtensions: ['tsx', 'ts', 'jsx', 'js']
};

module.exports = nextConfig;