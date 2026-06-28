<div align="center">

# Comms

**An open-source, self-hostable team inbox + ticketing platform for iMessage — and beyond.**

Think Beeper for enterprise, with a help desk built in. Share an iMessage number across your team,
assign conversations as tickets, use macros, and reply together — all from a clean, fast UI you host
yourself.

![License: MIT](https://img.shields.io/badge/license-MIT-black)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-black)
![Self-hostable](https://img.shields.io/badge/self--hostable-Railway-black)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-black)

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

## Deploy to Railway (step by step)

You'll create **one Railway project with four services** — Postgres, Redis, a **web**
service, and a **worker** service — all from this one repo. It takes about 10 minutes,
and you only ever type **one** value yourself (and even that is auto-generated).

> **The whole config in one glance — just 3 variables, set the same on both the web and worker services:**
>
> ```bash
> APP_SECRET=${{ shared.APP_SECRET }}
> DATABASE_URL=${{ Postgres.DATABASE_URL }}
> REDIS_URL=${{ Redis.REDIS_URL }}
> ```
>
> Everything else (your public URL, running migrations, etc.) is automatic. Email, AI,
> file attachments, and OAuth are **optional** and added later from inside the app or as
> extra variables — they are never required to get started.

### 1. Create the project from this repo

- Go to [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → pick your fork of `comms`.
- Railway creates one service from the repo. We'll make this the **web** service in step 4.

### 2. Add Postgres

- In the project, click **New** → **Database** → **Add PostgreSQL**. Leave it named **`Postgres`**.

### 3. Add Redis

- Click **New** → **Database** → **Add Redis**. Leave it named **`Redis`**.

> Keep the default names `Postgres` and `Redis` — the variable references below use them. If you rename a database, update the references to match.

### 4. Configure the web service

Open the repo service from step 1, then:

**a. Point it at the web config.** Settings → **Config-as-code / Railway Config File** → set the path to:

```
apps/web/railway.json
```

This tells Railway to build the Docker image, run database migrations automatically before each deploy, start the web server, and health-check `/api/health`.

**b. Add a shared `APP_SECRET` (do this once for the whole project).** Project **Settings → Shared Variables** → add:

| Name | Value |
| --- | --- |
| `APP_SECRET` | `${{ secret(48) }}` |

Railway generates a strong random secret for you. It is shared so the web and worker services use the **same** secret (required — it encrypts your integration credentials).

**c. Set the web service variables.** On the web service → **Variables** → **Raw Editor** → paste exactly:

```bash
APP_SECRET=${{ shared.APP_SECRET }}
DATABASE_URL=${{ Postgres.DATABASE_URL }}
REDIS_URL=${{ Redis.REDIS_URL }}
```

**d. Give it a public URL.** Settings → **Networking** → **Generate Domain**.

### 5. Add the worker service

- Click **New** → **GitHub Repo** → pick the **same** `comms` repo again.
- Settings → **Config File** → set the path to:

```
apps/worker/railway.json
```

- **Variables** → **Raw Editor** → paste the **same three lines** as the web service:

```bash
APP_SECRET=${{ shared.APP_SECRET }}
DATABASE_URL=${{ Postgres.DATABASE_URL }}
REDIS_URL=${{ Redis.REDIS_URL }}
```

- The worker has **no public port** — do **not** generate a domain for it.

### 6. Deploy & finish setup

- Railway builds and deploys all four services. The web service runs migrations automatically on its first deploy.
- Open the web service's domain (e.g. `https://your-app.up.railway.app`). You'll see the **first-run setup wizard** — create your admin account.
- Go to **Settings → Inboxes → Connect BlueBubbles** and paste your BlueBubbles server URL + password (see the next section).

That's it — you're live. 🎉

### The minimal variables, explained

| Variable | Required? | What to set | Why |
| --- | --- | --- | --- |
| `APP_SECRET` | ✅ Yes | `${{ secret(48) }}` (as a **shared** variable) | Signs sessions and encrypts integration credentials. Must be identical on web + worker. |
| `DATABASE_URL` | ✅ Yes | `${{ Postgres.DATABASE_URL }}` | Connects to Postgres. A reference — no value to type. |
| `REDIS_URL` | ✅ Yes | `${{ Redis.REDIS_URL }}` | Queues + realtime. A reference — no value to type. |
| *(public URL)* | ⚙️ Auto | — | Derived from Railway's generated domain. Nothing to set. |
| `ANTHROPIC_API_KEY` | ⬜ Optional | your Claude API key | Enables AI summaries, draft replies, and auto-triage. |
| `S3_*` | ⬜ Optional | from a Storage Bucket / S3 | Enables file attachments (see below). |
| `SMTP_*` | ⬜ Optional | your mail provider | Enables magic-link sign-in, invites, notifications. |
| `GOOGLE_*` / `GITHUB_*` | ⬜ Optional | OAuth app creds | Enables Google / GitHub sign-in. |

See [`.env.example`](./.env.example) for the full list with descriptions.

### Optional: file attachments

Attachments need S3-compatible storage. The easiest on Railway is a native **Storage Bucket**
(**New → Storage Bucket**). Then add these to **both** the web and worker services, mapping the
bucket's variables:

```bash
S3_ENDPOINT=${{ Bucket.ENDPOINT }}
S3_BUCKET=${{ Bucket.BUCKET_NAME }}
S3_ACCESS_KEY_ID=${{ Bucket.ACCESS_KEY_ID }}
S3_SECRET_ACCESS_KEY=${{ Bucket.SECRET_ACCESS_KEY }}
S3_REGION=auto
```

(Exact variable names depend on the bucket plugin — open the bucket's **Variables** tab to confirm. Any S3-compatible store works too: Cloudflare R2, Backblaze B2, AWS S3.)

### Troubleshooting

- **Web crashes on boot with a DB/Redis error** → the variable references didn't resolve. Confirm `Postgres` and `Redis` are the exact service names, and that the three variables are set on the service.
- **Webhook didn't register when connecting BlueBubbles** → your app needs a public URL BlueBubbles can reach. Make sure you generated a domain (step 4d); then in **Settings → Inboxes** click **Re-register webhook**.
- **Messages don't arrive / send** → check the **worker** service logs; it must be running with the same three variables as web.

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
