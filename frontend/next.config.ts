import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    // This explicitly tells Turbopack to look in the 'frontend' folder
    // which is the current directory of this config file.
    root: __dirname,
  },
} satisfies NextConfig;

export default nextConfig;
