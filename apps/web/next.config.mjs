import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: no `output: 'standalone'` — the Docker runtime stage ships the whole
  // workspace (including node_modules), and railway.json starts the app with
  // `next start`, which Next.js refuses to serve from a standalone build.
  // Trace files from the monorepo root so workspace deps resolve correctly.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  eslint: { ignoreDuringBuilds: true },
  // Keep native/node-only libs external to the bundle (used only in server code).
  serverExternalPackages: [
    'pg',
    'bullmq',
    'ioredis',
    '@aws-sdk/client-s3',
    'nodemailer',
    '@anthropic-ai/sdk',
  ],
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
};

export default nextConfig;
