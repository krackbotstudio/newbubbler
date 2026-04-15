/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003/api';
/** Same-origin proxy: Render↔Render, or admin on *.vercel.app calling API on another *.vercel.app (avoids browser CORS). */
const useProxy =
  apiUrl.includes('onrender.com') ||
  (apiUrl.startsWith('http') && apiUrl.includes('vercel.app'));

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  /** Allow slower static generation on CI (e.g. Render) where metadata or data fetches can be slow. */
  staticPageGenerationTimeout: 120,
  async rewrites() {
    if (!useProxy) return [];
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${apiUrl.replace(/\/$/, '')}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
