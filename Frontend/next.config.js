/** @type {import('next').NextConfig} */
const nextConfig = {
//  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    // Enable React 19 features
    ppr: false, // Partial Pre-rendering (can be enabled later)
  },

  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: false,
  },

  // API rewrites for proxying backend requests (development only)
  async rewrites() {
    // Only use rewrites in development - in production, use direct API calls
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8000/:path*',
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
