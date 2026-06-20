import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trace files from the monorepo root so the standalone bundle includes workspace deps.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  eslint: { ignoreDuringBuilds: true },
  // Keep native/node-only libs external to the bundle (used only in server code).
  serverExternalPackages: ['pg', 'bullmq', 'ioredis', '@aws-sdk/client-s3', 'nodemailer'],
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
};

export default nextConfig;
