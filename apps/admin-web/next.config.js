/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003/api';
/**
 * Render: rewrite /api-proxy → upstream (legacy). On Vercel, do not use external rewrites here — the App Router
 * `app/api-proxy/[...path]/route.ts` handler proxies to NEXT_PUBLIC_API_URL / API_BASE_URL. A duplicate external
 * rewrite can mis-route or conflict with standalone output.
 */
const useProxy = apiUrl.includes('onrender.com');

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
