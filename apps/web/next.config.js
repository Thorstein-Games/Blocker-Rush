/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@blocker-rush/shared"],
  experimental: {
    typedRoutes: false
  }
};

export default nextConfig;
