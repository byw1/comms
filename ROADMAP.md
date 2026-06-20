# Comms Roadmap

This roadmap turns the "cracked-engineer" vision into a sequenced program. Wave 0
(the foundation) is already in `main`/the dev branch: monorepo, schema, BlueBubbles
bridge, worker pipelines, auth, inbox + ticketing UI, Railway deploy.

Status legend: ✅ done · 🚧 in progress · ⬜ planned

---

## Wave 1 — AI-native + reliable (in progress)

The two headline bets: make Comms AI-native, and make the iMessage bridge
trustworthy. Both are mostly backend and shippable without new infra.

- 🚧 **AI layer (`packages/ai`)** — Claude-powered, provider-config via `ANTHROPIC_API_KEY`
  - 🚧 Conversation summarization ("catch me up")
  - 🚧 Suggested reply / draft in brand voice (RAG over past resolved replies)
  - 🚧 Auto-triage on new conversations: priority, topic, sentiment, suggested tags
  - ⬜ Eval harness: golden conversations + automated scoring + regression gates
  - ⬜ Smart compose / inline autocomplete
  - ⬜ Auto-resolve tier-1 with confidence threshold + human handoff
  - ⬜ Real-time translation (inbound + outbound)
  - ⬜ Voice-memo transcription + image understanding
- 🚧 **Reliability / deliverability**
  - 🚧 Adaptive send pacing (per-number token bucket to avoid Apple throttling)
  - 🚧 Self-healing ingestion (periodic reconcile/backfill to fill missed-webhook gaps)
  - ⬜ Transport failover (Socket.IO when webhooks unreachable; auto re-register on URL change)
  - ⬜ Per-recipient backoff + deliverability monitoring/alerts
  - ⬜ Liveness alerting when the Mac sleeps / tunnel rotates

## Wave 2 — Multi-agent collaboration ✅ (core)

What makes Comms enterprise rather than a personal bridge.

- ✅ Real-time presence ("Sarah is viewing / typing…") + collision warnings
- ✅ @mentions in internal notes with notifications (+ notification bell)
- ✅ Assignment rules engine (round-robin + least-busy auto-assignment)
- ⬜ Co-drafting a single reply (shared draft)
- ⬜ Skills-based / business-hours routing; escalation / handoff with context

## Wave 3 — Workflow & ticketing depth 🚧

- ✅ SLA timers + breach alerts (response-due clock, breach sweep, assignee notify)
- ✅ CSAT surveys delivered over iMessage after resolution (1–5 capture)
- ⬜ Automations: triggers → conditions → actions, with a visual builder
- ⬜ Saved views / custom inboxes / advanced filters
- ⬜ Merge / split / link conversations; bulk actions
- ⬜ Entity resolution: unify a person across phone/email/SMS/iMessage handles
- ⬜ Business-hours-aware SLA + pause-on-pending

## Wave 4 — Performance & UX excellence

- ⬜ Linear-style local sync engine (IndexedDB store + optimistic mutations + delta sync)
- ⬜ Full-text + semantic search (Postgres FTS + pgvector / Meilisearch)
- ⬜ Command palette (⌘K) + keyboard-first navigation
- ⬜ Native mobile app (reply on the go)
- ⬜ Rich iMessage parity from the UI: tapbacks, typing, edit/unsend, effects, scheduled send

## Wave 5 — Platform & extensibility

- ⬜ Channel driver abstraction (WhatsApp, SMS/Twilio, Instagram, Telegram, email)
- ⬜ Sidebar apps framework (Stripe/Shopify/CRM in the contact panel)
- ⬜ Public API + outbound webhooks + CLI; reply-from-Slack
- ⬜ Marketplace for macros / automations / apps

## Wave 6 — Trust, security, compliance (enterprise)

- ⬜ SSO/SAML/SCIM, granular RBAC, approval workflows
- ⬜ PII redaction, data-retention policies, GDPR delete
- ⬜ On-prem / air-gapped story; per-agent permissions

## The unfair advantage

Combine Wave 1 (AI autopilot + reliable ingestion) into: **an open-source,
self-hostable, AI-native iMessage support desk that resolves real tier-1 volume
and never drops a message.** No competitor can say that sentence today.
