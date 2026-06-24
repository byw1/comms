# Contributing to Comms

Thanks for your interest in improving Comms! This is an open-source, self-hostable
team inbox + ticketing platform for iMessage (via BlueBubbles) and beyond.

## Project layout

```
apps/
  web/      Next.js 15 (App Router) — UI, API routes, server actions, auth
  worker/   BullMQ worker — inbound ingestion, outbound sends, attachments,
            backfill, heartbeats, automations, SLA, AI triage
packages/
  db/       Drizzle ORM schema + migrations + client (Postgres)
  core/     Shared libs — config, crypto, Redis/queues, S3, realtime, BlueBubbles client
  ai/       Claude-powered features (summarize, suggest reply, triage)
```

## Getting started

Prerequisites: Node 22+, pnpm 10+, and a local Postgres + Redis.

```bash
pnpm install
cp .env.example .env            # set DATABASE_URL, REDIS_URL, APP_SECRET

pnpm --filter @comms/db build
pnpm db:generate                # only if you changed the schema
pnpm db:migrate
pnpm dev                        # web on :3000 + worker
```

## Before you open a PR

- `pnpm build` — the whole monorepo must build
- `pnpm typecheck` — must pass (strict TypeScript, `noUncheckedIndexedAccess`)
- `pnpm format` — Prettier
- If you changed `packages/db/src/schema`, run `pnpm db:generate` and commit the
  generated migration in `packages/db/migrations`.

## Conventions

- TypeScript everywhere; keep server-only code out of client components.
- Match the surrounding style — small, focused commits with clear messages.
- The roadmap lives in [`ROADMAP.md`](./ROADMAP.md); features are grouped into waves.

## Security

Found a vulnerability? Please open a private report rather than a public issue.
Never commit secrets — integration credentials are encrypted at rest and should
only ever be provided via environment variables or the in-app settings.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
