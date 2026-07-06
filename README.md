# 🏸 BadmintonSG

A mobile-first, no-account board where Singapore badminton players **resell balloted court
slots they can't use** and **find players for their games**. It replaces the "post into a
Telegram group and hope someone scrolls past it" workflow with a searchable, filterable board.

- **Courts** — a seller posts a court slot (venue, date, time, price); a buyer browses,
  filters, opens a listing, reveals the seller's phone, and contacts them directly.
- **Players** — a host posts a game that needs players (venue, date, skill level, cost per
  player); players find it the same way.

Everything after the match — payment, coordination — happens off-platform over the phone/WhatsApp.
There are no accounts, no payments, and no chat inside the app.

---

## Purpose & why it exists

In Singapore, courts at ActiveSG sports halls, community centres, and Dual-Use-Scheme school
halls are balloted weeks ahead. People who win a slot they can't use resell it in Telegram
groups, where listings get buried and buyers must scroll endlessly asking "is this still
available?". Players who *have* a court but not enough people face the same mess. BadmintonSG
turns both into a structured, filterable board that answers "what's available this Saturday
in the west?" in one tap.

**Design philosophy:** the fastest possible path from "I have/need a court" to "here's a phone
number to call". No sign-up friction, no login, used courtside on a phone.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router) | Server components for the board (fast, SEO-able), route handlers for the API, one deploy target |
| Language | **TypeScript** (strict) | Type-safe end to end; `npx tsc --noEmit` is a required gate |
| Styling | **Tailwind CSS v4** | Utility-first, mobile-first; custom tokens `court`/`court-light`/`paper` |
| ORM / DB | **Prisma 6 + PostgreSQL** (Supabase) | Typed queries, migrations; Postgres-backed rate limiting (no Redis) |
| Validation | **Zod** | One schema layer for API input **and** environment variables |
| Dates/time | **dayjs** (utc + timezone) | Confined to `src/lib/time.ts`; all court times are SGT wall-clock |
| Logging | **Pino** | JSON logs to stdout with `phone`/`editToken`/`url` redaction |
| Tests | **Jest + React Testing Library + Playwright** | Unit + component + one end-to-end core-loop |
| Analytics | **Vercel Analytics** | Free, privacy-light traffic measurement |
| Hosting | **Vercel + Supabase** | Both free tiers cover ~1,000 users/day at $0/mo |

---

## Architecture

The app is a single Next.js project with a strict internal boundary: **all database access
lives in `src/services/`; route handlers and pages only validate, call a service, and shape
the response.** This keeps the data logic testable and phone numbers structurally contained.

```
Browser (phone)
   │  fetch() / navigation
   ▼
Next.js App Router
   ├─ Server Components (pages)         src/app/**/page.tsx      ← board, detail, manage, post
   │     read via services (no phone)
   └─ Route Handlers (HTTP API)         src/app/api/**/route.ts  ← { data, error } envelope
         validate with Zod, call a service
   │
   ▼
Services  (the ONLY place Prisma runs)  src/services/*.ts
   listingService · sessionService · manageService
   rateLimitService · venueService · reportService
   │
   ▼
Prisma Client (singleton)               src/lib/db.ts
   │
   ▼
PostgreSQL (Supabase)                    Venue · Listing · GameSession
                                         RateLimitEvent · ReportFlag · VenueSuggestion
```

### Directory map

```
src/
  app/
    page.tsx                 Board homepage (Courts | Players tabs, date strip, filters)
    listing/[id]/page.tsx    Court detail + click-to-reveal
    session/[id]/page.tsx    Game detail + click-to-reveal
    post/                    Chooser + court form + game form
    manage/[token]/page.tsx  Secret manage page (mark sold/filled, delete) — doubles as success page
    venue-request/page.tsx   "Request a venue" form
    api/                     11 route handlers (listings, sessions, manage, venues, suggestions)
  components/                Cards, BottomSheet, DateStrip, FilterBar, VenuePicker, RevealButton, …
  services/                  All Prisma queries live here
  lib/
    env.ts                   Zod-validated environment variables
    db.ts                    Prisma client singleton (pooling-safe)
    time.ts                  SGT wall-clock time (the only dayjs user)
    schemas.ts               Zod input schemas + honeypot + SG phone validation
    ip.ts                    Salted IP hashing
    api.ts                   { data, error } envelope + error→status mapping
    logger.ts                Pino with PII redaction
prisma/
  schema.prisma              6 models
  venues.json                46 seeded venues (halls, CCs, DUS schools)
  seed.ts                    Idempotent upsert-by-name seeder
e2e/                         Playwright core-loop happy path
```

### Data models

- **Venue** — name, address, postalCode, region (NORTH/SOUTH/EAST/WEST/CENTRAL), venueType
  (SPORTS_HALL/COMMUNITY_CENTRE/SCHOOL/OTHER), optional availabilityNote (e.g. schools:
  "Weekends & school holidays only").
- **Listing** (a court for sale) — venue, date, start/end time, priceCents (`0`=free,
  `null`=negotiable), notes, **phone**, status (AVAILABLE/SOLD/EXPIRED), unique **editToken**.
- **GameSession** (a game seeking players) — like Listing plus playersNeeded, skillLevel,
  pricePerPlayerCents; status OPEN/FILLED/EXPIRED.
- **RateLimitEvent** — hashed IP + action + optional target, for Postgres-backed rate limiting.
- **ReportFlag** — abuse reports (idempotent per hashed IP).
- **VenueSuggestion** — "venue not listed" requests.

### How data flows (a court transfer, end to end)

1. **Post** — seller fills the court form → `POST /api/listings`. Zod validates (SG phone,
   date within today→+8 weeks, honeypot empty). The route rate-limits by hashed IP, then
   `listingService.createListing` writes the row and returns a secret `editToken`.
2. **Success = manage link** — the browser lands on `/manage/<editToken>?created=1`, which
   shows a "save this link" banner. That URL is the *only* way to edit the post (no login).
3. **Browse** — a buyer opens `/` (server component). `listingService.listListings` runs an
   on-read sweep (expire past posts, scrub old phones), then returns rows via
   `PUBLIC_LISTING_SELECT` — a select that **structurally omits `phone` and `editToken`**, so
   the number never reaches the browser.
4. **Reveal** — on the detail page the buyer taps "Reveal contact" → `POST
   /api/listings/[id]/reveal`. This endpoint is rate-limited (per IP+listing and globally) and
   is the *only* path that returns a phone number. The UI shows it with `tel:` and WhatsApp
   deep links.
5. **Close** — the seller opens their manage link and taps "Mark as sold" (`PATCH`) or
   "Delete" (`DELETE`). Sold posts stay on the board (badged, sorted last) until their date
   passes, then auto-expire.

### Time handling

A court slot is a Singapore wall-clock fact, so court dates/times are **never converted to
UTC**. `date` is a date-only column meaning the SGT calendar date; `startTime`/`endTime` are
`"HH:mm"` SGT strings. All "now" logic goes through `src/lib/time.ts` (the only file that
imports dayjs). `createdAt`/`updatedAt` remain normal UTC machine timestamps.

---

## Security & privacy

- **Phone numbers never appear in page HTML or list/detail JSON** — only the rate-limited
  reveal endpoint returns them. Enforced structurally by the `PUBLIC_*_SELECT` objects (the
  phone column is physically not selected), so a page literally cannot render it.
- **Rate limiting** (Postgres-backed, no Redis) — reveals capped per IP+target and globally
  (limits are generous because Singapore mobile carriers use CGNAT, sharing IPs); posting
  capped per IP and per phone number.
- **Anti-spam** — hidden honeypot field (a filled `website` field silently returns success
  and writes nothing), SG phone validation (`/^[89]\d{7}$/`), max 5 active posts per phone.
- **PDPA-minded** — IPs are stored only as salted SHA-256 hashes; phone numbers are scrubbed
  7 days after a post expires; the footer states exactly what's retained.
- **Manage links** — unguessable UUID tokens, `noindex` meta + `X-Robots-Tag` header, and
  Pino redaction so tokens/phones never hit logs.
- No `dangerouslySetInnerHTML` anywhere; Prisma parameterises all queries.

---

## Local development

**Prerequisites:** Node 18+, Docker Desktop (for local Postgres), npm.

```bash
# 1. Install dependencies
npm install

# 2. Start a local Postgres (mapped to host port 5433 to avoid clashing with a native pg)
docker compose up -d

# 3. Configure environment
cp .env.example .env          # values already point at the docker DB on port 5433

# 4. Apply migrations and seed the 46 venues
npx prisma migrate dev
npx prisma db seed

# 5. Run the app
npm run dev                   # http://localhost:3000
```

No Docker? Point `DATABASE_URL`/`DIRECT_URL` in `.env` at any Postgres (e.g. a free Supabase
project) and skip step 2.

### Environment variables (`.env`)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection. In production: Supabase **pooled** string (port 6543) + `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Direct Postgres connection (port 5432) — used by Prisma for migrations |
| `IP_HASH_SALT` | Secret salt for hashing IPs. Generate a fresh one for production: `openssl rand -hex 32` |

`src/lib/env.ts` validates these with Zod at startup, so a missing/malformed var fails fast.

### Commands

```bash
npm run dev          # dev server
npm run build        # production build (also the deploy gate)
npm test             # Jest unit + component tests (runs serially against the dev DB)
npm run test:e2e     # Playwright core-loop happy path
npx tsc --noEmit     # type-check (Jest uses SWC and does NOT type-check)
npm run lint         # ESLint
```

---

## Deployment (Vercel + Supabase)

At ~1,000 users/day both free tiers are comfortable (**~$0/month**). The one non-obvious
requirement is Supabase connection pooling — serverless functions exhaust direct connections
otherwise.

1. **Create a Supabase project** (region `ap-southeast-1` / Singapore). From
   **Settings → Database**, copy two connection strings:
   - **Pooled** (Transaction mode, port **6543**) → production `DATABASE_URL`, and append
     `?pgbouncer=true&connection_limit=1`.
   - **Direct** (port **5432**) → production `DIRECT_URL`.
2. **Apply schema + seed** against production (run once locally with the prod vars set):
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```
3. **Create a Vercel project** from this repo. Set env vars in the Vercel dashboard:
   `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `IP_HASH_SALT` (`openssl rand -hex 32`).
4. **Deploy** (`npx vercel --prod` or push to the connected branch).
5. **Smoke test** on the production URL: post a listing, reveal it from another browser, mark
   it sold, delete it. Confirm `/api/listings` responses contain no `phone` field.

> Vercel's Hobby tier is non-commercial — fine while the app is free to use. Growth triggers:
> Supabase Pro ($25) then Vercel Pro ($20), at roughly 10× traffic.

---

## Testing

- **Jest unit** (`src/**/__tests__`) — services (expiry sweep, rate-limit windows, the
  `phone`/`editToken` omission from public selects), `lib/time.ts` SGT boundaries, Zod schemas.
  Service tests hit the local Postgres and run serially (`--runInBand`).
- **React Testing Library** — cards, bottom sheet, date strip, venue picker, reveal button.
- **Playwright** (`e2e/core-loop.spec.ts`) — the whole loop: post court → browse → assert
  phone absent → reveal → mark sold; plus a game-board variant. The phone-absence and reveal
  assertions are the security-critical ones.

---

## Limitations & out of scope

This is a deliberately lean MVP. Known limitations:

- **No accounts, so no strong identity.** Anyone can post any phone number. The mitigations
  are a report button, per-phone/per-IP caps, and SG phone validation — not verified identity.
  If abuse appears, the documented next step is SMS OTP on posting (not built).
- **Trust-based transactions.** Payment and no-shows are entirely off-platform; the app only
  connects people. There is no escrow, rating, or dispute system.
- **Curated venues only.** You can't type a free-text venue (that would break filtering).
  Missing venues go through the "Request a venue" form and are added to the seed manually.
- **Coarse rate limiting.** Postgres-counted windows with a non-transactional check-then-write;
  a burst could allow an occasional extra reveal. Fine at this scale, not a hardened control.
- **No realtime.** The board is server-rendered per request; there are no live updates,
  notifications, or websockets. A buyer sees a slot as taken only on their next load.
- **Single region / SGT-only.** Times, phone format, and venues are Singapore-specific by design.
- **Manage link = full control.** Anyone with the secret link can edit/delete the post. Lose
  it and you can't manage your post (it still auto-expires after its date).

**Explicitly out of scope for the MVP:** auth, payments, a Telegram bot, notifications,
realtime updates, a moderation dashboard, "looking for a game" reverse posts, and venue
geolocation/nearby search.

---

## Project docs

- Design spec: [`docs/superpowers/specs/2026-07-06-badmintonsg-design.md`](docs/superpowers/specs/2026-07-06-badmintonsg-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-07-06-badmintonsg.md`](docs/superpowers/plans/2026-07-06-badmintonsg.md)
