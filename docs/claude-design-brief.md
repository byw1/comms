# Comms — Claude Design brief

> Paste this whole document into Claude Design as the opening prompt for a new
> Comms design-system project. Everything below is extracted from the live
> codebase (`apps/web`), so it describes what actually ships today — not an
> aspiration.

---

## 0. What I want from you

Build the **Comms design system** as a Claude Design project, then use it to
redraw the product's core screens and design the surfaces that don't exist yet.

Work in this order. Don't skip ahead — the system has to exist before the
screens are worth drawing.

**Phase 1 — Codify the system.** Foundation pages: color (light + dark), type
scale, density/spacing, radius, elevation, motion, iconography. Then component
sheets for every component listed in §5, each showing all variants and states
(default / hover / active / focus / disabled / loading).

**Phase 2 — Redraw the three core screens** exactly to the specs in §6: the
inbox list, the conversation thread, and the ticket panel. Each one in light
*and* true-black dark, at desktop (1440) and mobile (390).

**Phase 3 — Design what doesn't exist yet** (§7): a reporting dashboard, a
connection-health view, and a landing page for the open-source project.

Show me Phase 1 before starting Phase 2.

---

## 1. What Comms is

Comms is an **open-source, self-hostable team inbox + ticketing platform for
iMessage**. Think "Beeper for enterprise, with a help desk built in."

A company points a shared iMessage number at Comms (via a BlueBubbles bridge
running on a Mac in their office), and their whole support team works that
number together: every conversation becomes a ticket with a status, priority,
assignee, tags and an SLA clock. Agents reply from a shared queue, leave
internal notes the customer never sees, fire one-click macros, and hand
conversations off to each other without collisions.

iMessage is the first channel. The architecture is channel-agnostic — WhatsApp,
SMS and others are planned — so nothing in the design should be so
iMessage-specific that a second channel breaks it.

**Stack the designs must land in:** Next.js 15 (App Router), TypeScript,
Tailwind CSS, shadcn/ui (Radix primitives), Framer Motion, lucide-react icons.
Anything you design has to be buildable with those. No new icon set, no new
font, no CSS I can't express as Tailwind utilities against the tokens in §4.

---

## 2. Who uses it, and what they're actually doing

**Primary: the support agent.** Lives in this app 6+ hours a day, keyboard-first,
two monitors, dozens of conversations open in a day. Their loop is: scan the
queue → open the top one → read → reply → close → next. Every millisecond and
every pixel of friction in that loop is multiplied by hundreds of repetitions.
They are not admiring the UI. They are *reading* it, fast, in peripheral vision.

**Secondary: the support lead.** Sets up the workspace, writes macros and
automation rules, sets SLA targets, invites the team, watches whether the
connection is healthy. Visits settings a few times a week, not daily.

**Tertiary: the self-hoster.** A technical founder deploying Comms to Railway
for their own company. They meet the product at the setup wizard and the
BlueBubbles connection flow. If those two screens feel shaky, they never get
to the inbox.

**Design implication:** the inbox is a *tool* — dense, quiet, fast, and it
should disappear. Settings and onboarding are *documents* — roomier, more
explanatory, allowed to breathe.

---

## 3. Design principles — the existing point of view

These are already committed to in code. Honor them; sharpen them; don't
overturn them without telling me why.

**1. Strict monochrome. Black is the accent.**
There is no brand hue. Active nav states, primary buttons, focus rings, unread
markers and outbound message bubbles are all *ink* — near-black on white, white
on near-black. The `--brand` token exists but is an alias for ink. A purple or
blue SaaS accent would be a regression.

**2. Color is a signal, never decoration.**
Only three hues survive, and only for meaning: **red** = failure / overdue,
**green** = connected / success, **amber** = warning / internal note. When color
appears in the interface, the eye should learn that something needs attention.
The one exception: user-chosen tag and channel colors, always rendered as a
tinted background (`color + 18` alpha) with saturated text — never a solid fill.

**3. Dark mode is true black.**
`#000` canvas so OLED pixels actually switch off. Surfaces lift *barely* above
it (4.5% lightness). In dark mode, shadows stop working — **borders do the
separating**. Design dark mode as its own thing, not an inverted screenshot.

**4. Density with air.**
Body text in the working surfaces is 13–13.5px, list rows are ~9px vertical
padding, section labels are 10.5px. This is deliberately tighter than default
Tailwind/shadcn. But density is not cramming: the gap between *groups* stays
generous even as the gap between *rows* tightens.

**5. Motion is feedback, never ornament.**
Two curves only (§4.5). Active states slide between positions as a shared
element rather than popping on and off. Buttons compress 3% on press. Bubbles
enter with a slight overshoot. Everything respects `prefers-reduced-motion`.

**6. State is always legible.**
Every send has a visible lifecycle: queued → sending → sent → delivered → read,
plus failed and "waiting" (parked because the bridge Mac is unreachable). The
user should never have to guess whether something went out.

**Reference points for the feel:** Superhuman (the triage loop, the keyboard
grammar), Linear (density, restraint, motion discipline), Attio and Height
(monochrome enterprise surfaces). **Not** Intercom, not Zendesk, not HubSpot —
no illustration-heavy empty states, no gradient hero cards, no mascots.

---

## 4. The design system (current tokens — this is the source of truth)

All colors are stored as HSL channel triplets consumed via
`hsl(var(--token))`. Keep that structure; if you change a value, change it as
an HSL triplet.

### 4.1 Color — light

| Token | HSL | ≈ Hex | Used for |
|---|---|---|---|
| `background` | `0 0% 100%` | `#FFFFFF` | Page canvas |
| `surface` | `0 0% 100%` | `#FFFFFF` | Panels, list, thread |
| `surface-sunken` | `0 0% 97.6%` | `#F9F9F9` | Sidebar, auth page ground |
| `foreground` | `0 0% 5%` | `#0D0D0D` | Primary text |
| `primary` / `brand` | `0 0% 7%` | `#121212` | Ink: buttons, active states, outbound bubbles |
| `primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on ink |
| `secondary` / `muted` | `0 0% 95.5%` | `#F4F4F4` | Inbound bubbles, chips, kbd |
| `muted-foreground` | `0 0% 44%` | `#707070` | Secondary text, timestamps |
| `accent` | `0 0% 95%` | `#F2F2F2` | Hover fills |
| `brand-muted` | `0 0% 94.5%` | `#F1F1F1` | Active nav pill, selected row |
| `brand-border` | `0 0% 85%` | `#D9D9D9` | Ink-adjacent borders |
| `border` | `0 0% 90.5%` | `#E7E7E7` | Hairlines, dividers |
| `border-strong` | `0 0% 83%` | `#D4D4D4` | Outline buttons, scrollbar thumb |
| `input` | `0 0% 88%` | `#E0E0E0` | Field borders |
| `ring` | `0 0% 7%` | `#121212` | Focus ring |
| `destructive` | `0 65% 48%` | `#CA2B2B` | Failure, overdue |
| `destructive-muted` | `0 70% 97%` | `#FEF3F3` | Tinted danger background |
| `success` | `152 45% 38%` | `#358D64` | Connected, resolved |
| `success-muted` | `152 40% 96%` | `#F0F8F4` | Tinted success background |
| `warning` | `35 80% 44%` | `#CA7F16` | Internal notes, pending |
| `warning-muted` | `40 75% 96%` | `#FCF6EC` | Note bubble background |

### 4.2 Color — dark (true black)

| Token | HSL | ≈ Hex |
|---|---|---|
| `background` | `0 0% 0%` | `#000000` |
| `surface` | `0 0% 4.5%` | `#0B0B0B` |
| `surface-sunken` | `0 0% 2.5%` | `#060606` |
| `foreground` | `0 0% 96%` | `#F5F5F5` |
| `popover` | `0 0% 6%` | `#0F0F0F` |
| `primary` / `brand` | `0 0% 100%` | `#FFFFFF` |
| `primary-foreground` | `0 0% 5%` | `#0D0D0D` |
| `secondary` / `brand-muted` | `0 0% 11%` | `#1C1C1C` |
| `muted` | `0 0% 10%` | `#1A1A1A` |
| `muted-foreground` | `0 0% 58%` | `#949494` |
| `accent` | `0 0% 12%` | `#1F1F1F` |
| `border` | `0 0% 13.5%` | `#222222` |
| `border-strong` / `brand-border` | `0 0% 22–24%` | `#383838` / `#3D3D3D` |
| `input` | `0 0% 15%` | `#262626` |
| `destructive` | `0 60% 55%` | `#D14747` |
| `success` | `152 40% 48%` | `#49AB7E` |
| `warning` | `38 75% 55%` | `#E2A336` |

Semantic `-muted` backgrounds in dark mode are near-black tints of their hue
(e.g. `destructive-muted: 0 45% 12%`), not washed pastels.

### 4.3 Typography

- **Sans:** Inter (self-hosted via `next/font`), with `cv02 cv03 cv04 calt` on.
- **Mono:** JetBrains Mono — phone numbers, handles, ticket numbers, macro shortcuts.
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) on every number
  that sits in a column: timestamps, unread counts, ticket `#1042`, SLA clocks.

The scale is intentionally granular and sub-pixel-tuned. Treat these as real
tokens, not suggestions:

| Size | Weight / tracking | Where |
|---|---|---|
| 10.5px | 600, uppercase, `+0.07em` | Section labels ("CONVERSATIONS", "TICKET") |
| 10.5px | 400 | Keyboard hints, timestamps under bubbles |
| 11px | 500 | Badges (sm), count pills, list timestamps |
| 11.5px | 500 | Tag chips, status text, composer mode toggle |
| 12–12.5px | 400 | Ticket-panel fields, secondary body |
| 13px | 500 / 600 when unread | Conversation-list names, nav rows |
| 13.5px | 400 | **Message bubbles, composer, command palette** |
| 14px | 600, `-0.01em` | Conversation header title, contact name |
| 15px | 600, `-0.01em` | Empty-state headings |
| 21.6px | 600, `-0.02em` | Auth page titles |

Headings tighten tracking (`-0.01em` to `-0.02em`); uppercase labels open it
(`+0.07em`). Nothing in the product is larger than ~22px today — a marketing
page (§7.3) is allowed to break that, the app is not.

### 4.4 Radius, elevation, spacing

- **Base radius `0.65rem` (10.4px).** Scale: `sm` = base − 5px, `md` = base − 3px,
  `lg` = base, `xl` = base + 3px, `2xl` = base + 6px.
- **Message bubbles are the exception: `1.15rem` (18.4px)** — iMessage-native.
  Consecutive same-side messages square off to `md` on the joining edge so a
  run of messages reads as one block.
- **Five shadow steps** (`xs` → `xl`), all very low opacity, all downward-only.
  In light mode a resting card is `shadow-xs`; hover lifts to `sm`/`md`; press
  flattens. In dark mode shadows are nearly invisible by design.
- **Layout widths:** sidebar `248px`, conversation list `344px`, ticket panel
  `288px` (lg+) / `320px` max as a slide-over below that. Header rows are `52px`.

### 4.5 Motion

Exactly two curves:

- `ease-smooth` = `cubic-bezier(0.32, 0.72, 0, 1)` — the workhorse. Hovers,
  color changes, state transitions. 150–250ms.
- `ease-spring` = `cubic-bezier(0.34, 1.56, 0.64, 1)` — gentle overshoot for
  things that *appear*. Bubbles, popovers, badges. 180–350ms.

Named behaviors already in the product, which you should keep and extend:

- **Shared-element active pill.** The sidebar's active-nav background and the
  segmented controls (Active/Mine/Closed, Reply/Note) are one element that
  *slides* between positions via Framer Motion `layoutId` — spring, stiffness
  500, damping 38. This is the single clearest "this was designed" signal in the
  app.
- **`bubble-in`** — new messages fade up 10px with a 0.97→1 scale.
- **Press compression** — every button `active:scale-[0.97]`.
- **Checkbox-in-avatar swap** — hovering a conversation row cross-fades the
  avatar into a selection checkbox in the same 36px slot. No layout shift.
- **Skeleton sheen** — a 1.8s shimmer sweep for loading placeholders.
- All of it collapses to ~0ms under `prefers-reduced-motion`.

### 4.6 Iconography

lucide-react, `1.5` stroke, sized in odd increments to match the type scale:
`h-3 w-3` (12px) inside labels, `h-3.5` (14px) in buttons, `h-[15px]` in nav
rows, `h-4` (16px) for primary actions, `h-5` (20px) for mobile touch targets.
Icons are `muted-foreground` at rest and inherit `foreground` on hover.

---

## 5. Component inventory

**shadcn/ui primitives in use** (Radix-backed): Avatar, Badge, Button, Card,
Dialog, DropdownMenu, Input, Label, Popover, ScrollArea, Select, Separator,
Skeleton, Switch, Tabs, Textarea, Tooltip, Sonner (toasts).

Two of these carry non-default variant sets you must reproduce:

**Button** — variants `default` (ink), `brand` (alias of ink), `destructive`,
`outline`, `secondary`, `ghost`, `link`. Sizes `lg` (h-11), `default` (h-9),
`sm` (h-8), `xs` (h-7), `icon` (36²), `icon-sm` (32²). Plus a **loading** state
that swaps content for a centered spinner *while preserving button width*.

**Badge** — variants `default`, `brand`, `secondary`, `destructive`, `outline`,
and the four **soft** variants that are the default choice for status:
`soft-brand`, `soft-danger`, `soft-success`, `soft-warning` — tinted background,
saturated text, hairline border. Soft variants exist because status badges get
read dozens at a time in peripheral vision at 11px; solid fills shout. Sizes
`default` and `sm`.

**Product components to draw sheets for:**

| Component | Notes |
|---|---|
| `Logo` | Flat ink tile + "Comms" wordmark. Speech-bubble glyph, no gradient. 3 sizes. |
| Sidebar `NavRow` | Icon / label / count pill / optional channel status dot. Active = sliding ink-muted pill. |
| Sidebar `SectionLabel` | 10.5px uppercase, optional trailing action button. |
| Conversation row | Avatar, name, preview, timestamp, priority spine, badge cluster (unread count, SLA, status, channel chip, tag chips). ~5 states. |
| `FilterBar` | Tag / assignee / priority / SLA / unread / sort filters + saved views. |
| Segmented control | Active/Mine/Closed and Reply/Note. Sliding indicator. |
| Message bubble | Inbound / outbound / internal note. Grouped-corner logic. Reaction pill. |
| `StatusTick` | queued (clock) · waiting (cloud-off, amber) · sending (spinner) · sent (✓) · delivered (✓✓) · read (✓✓ ink) · failed (alert, red). |
| `TimelineNote` | Centered pill for system events and tapback notices. |
| `AttachmentView` | Image, file, and **voice memo with inline player + transcript**. |
| `Composer` | Single bordered surface: mode toggle + AI/macro toolbar + growing textarea + send. Reply-to banner. Ghost-text AI draft accepted with Tab. Note mode retints the whole surface amber. |
| `MacroPicker` | Slash-command autocomplete, keyboard-driven. |
| Ticket panel `Section` / `Field` | Label-left, control-right, 58% control width. |
| AI summary card | Sparkles icon, ink-tinted card, topic + sentiment chips. |
| `CommandPalette` | ⌘K dialog at 18% from top, search row / results / footer hint bar. |
| `PresenceBar` | "Sarah is viewing / typing…" avatars + collision warning. |
| `NotificationsBell` | @mention notifications with unread dot. |
| `ChannelHealthBanner` | Full-width alert when a bridge connection degrades. |
| `AuthShell` | Signed-out frame: dot-grid backdrop with a radial mask, centered 400px column. |
| `SettingsNav` | Underline tab row, horizontally scrollable on mobile. |
| Empty states | **Inbox Zero** (ink tile + check), no-matches, not-connected-yet. Text-only, no illustrations. |

---

## 6. Screens that exist today (redraw these)

Light + dark, desktop 1440 + mobile 390, for each.

### 6.1 `/inbox` — the queue
Three columns: **sidebar 248px** (`surface-sunken`) → **conversation list 344px**
(`surface`) → **empty detail pane**.

Sidebar top to bottom: 52px header (logo, search button, notifications bell) ·
"CONVERSATIONS" (All / Assigned to me / Unassigned, each with a count pill) ·
"VIEWS" (saved filters) · "CHANNELS" (connected numbers, each with a colored
status dot; a dashed "Connect a number" row when empty) · "WORKSPACE"
(Settings) · user menu pinned to the bottom.

List pane: search field · Active/Mine/Closed segmented control · filter bar ·
a bulk-action strip that springs open when rows are selected · the rows.

Each row: 36px avatar (swaps to a checkbox on hover), name (semibold when
unread), one-line preview, right-aligned timestamp, a 3px **priority spine** on
the left edge (red = urgent, amber = high, invisible otherwise), and a wrapping
badge row beneath — unread count, "Overdue" / "due in 20m", status, channel
chip, tag chips.

### 6.2 `/inbox/[id]` — the thread
Sidebar + list + **thread (flex)** + **ticket panel 288px**.

Thread header (52px, translucent + backdrop blur): contact name · mono `#1042`
· status dot + label · presence avatars · Snooze (with `s` kbd hint) · Close
(with `e` kbd hint) · details toggle below lg.

Thread body: day dividers as a hairline that fades at both ends · grouped
message bubbles · timestamp + status tick only on the last message of a run ·
hover-revealed reply/react actions on the outer edge of each bubble.

Composer at the bottom (see §5).

Ticket panel: centered contact block (56px avatar, name, mono handle) · AI
summary card · Ticket section (Assignee / Status / Priority selects, all
optimistic) · Tags · Service level (SLA state + CSAT stars) · Channel.

### 6.3 Settings
Underline tab nav across six pages: **General** (workspace name, SLA targets,
your account) · **Inboxes & Channels** (connection cards + the guided
BlueBubbles setup wizard) · **Team** · **Tags** · **Macros** · **Automations**
(a no-code trigger → condition → action rule builder — the most complex form in
the product, worth its own attention).

Roomier than the inbox: cards, 14px body, real vertical rhythm.

### 6.4 Signed-out: `/setup` and `/login`
Both use `AuthShell`. `/setup` is the first-run wizard that creates the admin
account. `/login` offers password, magic link, and Google/GitHub SSO — and has
to look complete when only *one* of those is configured, since self-hosters
often enable just one.

### 6.5 Mobile (below `md`)
A 48px top bar (hamburger / logo / bell), the sidebar becomes a left drawer
with a scrim, and the inbox becomes master–detail: the list owns the screen at
`/inbox` and is replaced by the thread at `/inbox/[id]`, with a back chevron.
The ticket panel becomes a right slide-over. Touch targets go to 44px.

### 6.6 The keyboard grammar (design around it, don't design it away)
`⌘K` palette · `j`/`k` next/previous conversation · `e` close · `s` snooze ·
`r` reply (focus composer) · `t` tag · `?` shortcut sheet · `/` macros inside
the composer · `Tab` accepts the AI draft · `↵` sends, `⇧↵` newline.
Shortcut hints render as `kbd` chips inline on the buttons they belong to.

---

## 7. What doesn't exist yet (design these fresh)

### 7.1 Reporting & analytics
Nothing exists. Needed: conversation volume over time, first-response and
resolution times against SLA targets, SLA breach rate, CSAT distribution
(1–5, collected over iMessage after resolution), per-agent workload and
throughput, tag/topic breakdown. It has to work in strict monochrome — charts
get ink plus the three semantic hues, nothing else. Solve the multi-series
problem with texture, weight and opacity rather than a rainbow.

### 7.2 Connection health / observability
Self-hosters need one screen that answers "is my bridge alive?": per-connection
status, last heartbeat, queue depth, send-failure rate, webhook registration
state, Private API availability, and a clear recovery action when the Mac
sleeps or the tunnel rotates. Today this is scattered across a banner and the
inboxes settings page.

### 7.3 A landing page for the open-source project
Comms is MIT-licensed and lives on GitHub; there is no marketing surface. Needs
to sell the one sentence — *an open-source, self-hostable, AI-native iMessage
support desk* — to technical founders, and route them to a one-click Railway
deploy. This is the one place the strict-monochrome rule may relax slightly and
type may go large, but it must still read as the same product.

---

## 8. Constraints and non-negotiables

**Do:**
- Build everything from the §4 tokens. If you need a value that doesn't exist,
  propose it as a new token rather than a one-off hex.
- Design light and dark as peers. Check every surface at `#000`.
- Keep the density. If a screen feels roomier than the current inbox, it's wrong.
- Keep numbers tabular and handles mono.
- Show real content — real names, real message text, real timestamps, realistic
  queue lengths (30+ conversations). Lorem ipsum hides density problems.
- Show the ugly states: a failed send, an overdue SLA, a disconnected bridge, a
  conversation with nine tags, a 400-word inbound message.

**Don't:**
- No colored brand accent. No purple, no indigo, no gradient buttons.
- No glassmorphism beyond the one existing translucent-blur header.
- No fully-rounded pill buttons; the radius scale tops out at ~16px (bubbles
  excepted).
- No illustrations, mascots, or emoji in the chrome. (Emoji appear only as
  literal iMessage tapback content.)
- No new fonts, no new icon library.
- Don't design anything that can't be built with Tailwind + shadcn/ui + Framer
  Motion.

---

## 9. First question back to me

Before you start Phase 1, tell me the **two or three places where the current
system is weakest** — where the monochrome discipline is costing legibility,
where the density crosses into cramped, or where a token is doing two jobs at
once. I'd rather fix the foundation than restyle on top of it.
