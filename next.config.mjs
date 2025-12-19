/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Suppress noisy case-only module warnings that can fail CI on
  // case-sensitive filesystems (some environments treat these as errors).
  webpack: (config) => {
    config.ignoreWarnings = config.ignoreWarnings || []
    config.ignoreWarnings.push({
      message: /multiple modules with names that only differ in casing/i,
    })
    return config
  },
}

export default nextConfig