
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // This is to handle a warning from handlebars which is a dependency of genkit
    config.externals.push({
      'handlebars': 'commonjs handlebars',
    });
    // This helps avoid issues with certain packages that expect a browser environment.
    if (!isServer) {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            'fs': false,
            'net': false,
            'tls': false,
        };
    }
    return config;
  },
};

export default nextConfig;
