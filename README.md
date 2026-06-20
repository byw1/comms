<div align="center">

# Comms

**An open-source, self-hostable team inbox + ticketing platform for iMessage — and beyond.**

Think Beeper for enterprise, with a help desk built in. Share an iMessage number across your team,
assign conversations as tickets, use macros, and reply together — all from a clean, fast UI you host
yourself.

</div>

---

## What is Comms?

Comms turns a shared iMessage number into a collaborative support inbox. It connects to
[BlueBubbles](https://bluebubbles.app) (the open-source iMessage bridge you run on a Mac) and layers a
real ticketing workflow on top: assignment, statuses, priorities, internal notes, tags, and macros.

iMessage is the first channel. The architecture is channel-agnostic, with WhatsApp and others planned.

### Features

- 📨 **Shared inbox** — every iMessage conversation in one place, in real time (SSE-powered live updates)
- 🎫 **Ticketing** — status (open / pending / snoozed / closed), priority, assignment to people, tags
- 📝 **Internal notes** — discuss a conversation privately without messaging the customer
- ⚡ **Macros** — one-click canned responses
- 👥 **Multi-agent safe** — per-conversation send serialization + echo reconciliation so two agents
  on one number never collide
- 🔌 **BlueBubbles bridge** — auto webhook registration, Private API feature detection, history backfill
- 🔐 **Flexible auth** — local email + password (zero config), magic-link email, and Google/GitHub SSO
- 🎨 **Clean, enterprise UI** — black & white, shadcn/ui + Framer Motion
- 🚀 **One-click Railway deploy** — almost zero environment variables to set

## Deploy on Railway

Comms is designed to deploy as a Railway template with the **minimum possible configuration**:

| Concern | How it's handled |
| --- | --- |
| Postgres | One-click managed service; `DATABASE_URL` wired by reference |
| Redis | One-click managed service; `REDIS_URL` wired by reference |
| Object storage | Railway **Storage Bucket** (native, S3-compatible); `S3_*` wired by reference |
| App secret | Auto-generated with `${{ secret() }}` |
| Public URL | Derived from `RAILWAY_PUBLIC_DOMAIN` |
| Migrations | Run automatically before each deploy (`preDeployCommand`) |

The template provisions four services from this one repo/image:

- **web** — the Next.js app (public)
- **worker** — the background processor (BullMQ; no public port)
- **Postgres**
- **Redis**

…plus a **Storage Bucket** for attachments. After deploying, you only ever need to open the app, run
the first-run setup wizard, and connect your BlueBubbles server from **Settings → Inboxes**.

> Email (magic-link/invites) and OAuth/SSO are fully optional and configured later via environment
> variables — they are never required to get started.

## How the iMessage bridge works

```
 iPhone/Mac  ⇄  iMessage  ⇄  BlueBubbles server (your Mac)  ⇄  Comms (web + worker)  ⇄  your team
```

1. You run [BlueBubbles](https://docs.bluebubbles.app) on a Mac signed into iMessage and expose it
   (Cloudflare Tunnel, ngrok, or your own domain).
2. In Comms, go to **Settings → Inboxes → Connect BlueBubbles** and paste the server URL + password.
   Comms verifies the connection, detects whether the Private API is available (reactions, typing,
   edits), registers an inbound webhook, and backfills recent history.
3. Inbound messages flow in via webhook → worker → your shared inbox. Replies are queued and sent
   through a per-conversation lock so multiple agents stay in sync.

For the richest feature set (reactions, typing indicators, edit/unsend, read receipts), enable the
BlueBubbles **Private API** on the Mac. Comms automatically falls back to basic mode if it isn't
available.

## Architecture

A pnpm monorepo, one Docker image, two runtime roles:

```
apps/
  web/      Next.js 15 (App Router) — UI, API routes, server actions, auth
  worker/   BullMQ worker — inbound ingestion, outbound sends, attachments, backfill, heartbeats
packages/
  db/       Drizzle ORM schema + migrations + client (Postgres)
  core/     Shared libs — config, crypto, Redis/queues, S3 storage, realtime, BlueBubbles client
```

- **Database:** Postgres via Drizzle ORM
- **Queues + realtime:** Redis (BullMQ for jobs, pub/sub for live UI updates over SSE)
- **Storage:** any S3-compatible store (Railway Storage Bucket, Cloudflare R2, MinIO, AWS S3)
- **Auth:** Auth.js (NextAuth v5) — credentials + magic-link + OAuth
- **UI:** Tailwind CSS + shadcn/ui + Framer Motion

## Local development

Prerequisites: Node 22+, pnpm 10+, and a local Postgres + Redis (or Docker).

```bash
pnpm install
cp .env.example .env            # set DATABASE_URL, REDIS_URL, APP_SECRET

pnpm --filter @comms/db build   # build the db package
pnpm db:generate                # generate the SQL migration from the schema
pnpm db:migrate                 # apply migrations

pnpm dev                        # runs web (http://localhost:3000) + worker
```

Open http://localhost:3000 and complete the setup wizard to create your admin account.

### Useful scripts

| Command | Description |
| --- | --- |
| `pnpm build` | Build all packages and apps |
| `pnpm dev` | Run web + worker in watch mode |
| `pnpm db:generate` | Generate a Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm typecheck` | Type-check the whole repo |

## Roadmap

- [ ] Outbound attachments & reactions from the UI
- [ ] Command palette + keyboard shortcuts
- [ ] SLA timers & reporting
- [ ] WhatsApp and additional channels
- [ ] Saved views & advanced search
- [ ] Multi-tenant (hosted) mode

## License

MIT — see [LICENSE](./LICENSE).
