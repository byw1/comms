import { defineConfig } from 'drizzle-kit';

// `generate` only reads the schema and never connects, so a placeholder URL is
// fine when DATABASE_URL is absent (e.g. generating migrations in CI).
const url = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/comms';

export default defineConfig({
  // Point at the compiled schema (ESM with .js specifiers) so drizzle-kit can
  // load it without TS path-resolution issues. Run `pnpm --filter @comms/db build` first.
  schema: './dist/schema/index.js',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
