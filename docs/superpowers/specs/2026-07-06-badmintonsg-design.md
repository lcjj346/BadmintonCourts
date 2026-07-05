# BadmintonSG — Design Spec

**Date:** 2026-07-06
**Status:** Approved for planning

## 1. Problem & Product

In Singapore, badminton courts at ActiveSG sports halls, community centres, and dual-use-scheme
school halls are balloted weeks in advance. Players who win a slot but can't use it resell it in
Telegram groups, where listings get buried and availability is unknowable without asking. Players
who *have* a court but lack players also recruit in the same groups, with the same problems.

**BadmintonSG** is a mobile-first, no-account listing board with two sides:

- **Courts** — sellers post a court slot they can't use; buyers find and contact them.
- **Players** — hosts post a game that needs players; players find and contact them.

Transactions and coordination happen off-platform via revealed phone numbers. No auth, no
payments, no chat.

## 2. Scope

### MVP (this build)

- Post a court listing (< 1 minute, no sign-up) → success page with secret manage link
- Post a game session (find players) → same flow
- `/manage/[editToken]`: mark sold (listing) / filled (session), or delete
- Board homepage: Courts | Players tabs, date-strip browsing, filters
- Detail pages with click-to-reveal contact (rate-limited)
- Auto-expiry after the court/game date; PDPA phone scrubbing
- Report button on posts (flags to a table; no moderation UI)
- Venue seed data: ActiveSG sports halls, CCs, dual-use-scheme schools
- Deployable to Vercel + Supabase free tiers

### Out of scope

Auth/accounts, payments, Telegram bot, notifications, real-time updates, chat, moderation
dashboard, SMS OTP (documented as the escalation path if fake-listing abuse appears),
"looking for a game" reverse posts (players without courts), venue geolocation/nearby search.

## 3. UX Decisions (resolved via brainstorm)

### 3.1 Homepage is the board

No landing page. `/` shows live listings immediately: header, **Courts | Players tabs**,
date strip, filter chips, listing cards, floating **+** post button. Zero taps to inventory.

### 3.2 Date strip + day list (browse layout)

- Horizontal scrollable pills for the next ~14 days: `Today`, `Tmrw`, `Sat 14`, …
- A **📅 button** at the end of the strip opens a month-picker bottom sheet for jumping
  further out (days with posts highlighted).
- The list below shows only the selected day's posts.

### 3.3 Bottom-sheet filters

Filter chips under the date strip; tapping a chip opens a bottom sheet:

- **Region** — five pills: North / South / East / West / Central.
- **Venue** — searchable sheet: type-ahead search box on top, results grouped by region,
  venue-type badge on each row. (100–150+ venues; a plain dropdown is unusable.)
- **Time** — coarse buckets: Morning (before 12:00) / Afternoon (12:00–18:00) /
  Evening (after 18:00). Exact-hour filtering would mostly return empty with 2-hour blocks.
- **Skill** (Players tab only) — Beginner / Intermediate / Advanced.

Active filters render as dismissible chips (`Region: East ✕`). Filter state lives in URL
search params so filtered views are shareable and survive refresh.

### 3.4 Cards and detail

- Card: venue name, time range, region, price (or "Free"), status badge; Players cards add
  "needs N" and skill level. SOLD/FILLED cards stay visible (badged, dimmed, sorted last)
  until the date passes — signals the board is alive.
- Detail page: all fields, venue address, **Reveal contact** button → phone number with
  `tel:` and WhatsApp deep links.

### 3.5 Post flow

- Floating **+** → chooser: "Sell a court slot" / "Host a game (find players)".
- Both forms: searchable venue combobox (same component as the filter sheet), date picker
  (today → +8 weeks), start time + 2-hour-default end time, price, notes, phone.
  Game form adds players-needed and skill level.
- "Venue not listed? Request it" link on the form → writes a `VenueSuggestion` row.
- Success page: prominent manage link with copy button and a "save this link — it's the only
  way to edit your post" warning.

## 4. Data Model (Prisma / PostgreSQL)

```prisma
enum Region     { NORTH SOUTH EAST WEST CENTRAL }
enum VenueType  { SPORTS_HALL COMMUNITY_CENTRE SCHOOL OTHER }
enum ListingStatus { AVAILABLE SOLD EXPIRED }
enum SessionStatus { OPEN FILLED EXPIRED }
enum SkillLevel { BEGINNER INTERMEDIATE ADVANCED }
enum RateAction { REVEAL CREATE }

model Venue {
  id               String    @id @default(uuid())
  name             String
  address          String
  postalCode       String
  region           Region
  venueType        VenueType
  availabilityNote String?   // e.g. "Weekends & school holidays only" for DUS schools
  listings         Listing[]
  sessions         GameSession[]
}

model Listing {
  id         String        @id @default(uuid())
  venueId    String
  venue      Venue         @relation(fields: [venueId], references: [id])
  date       DateTime      @db.Date      // SGT calendar date — see §5
  startTime  String                       // "08:00" SGT wall-clock
  endTime    String                       // "10:00"
  priceCents Int?                         // 0 = free, null = negotiable
  notes      String?
  phone      String?                      // nullable: scrubbed post-expiry (§7). NEVER in public selects
  status     ListingStatus @default(AVAILABLE)
  editToken  String        @unique @default(uuid())
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  @@index([date, status])
  @@index([venueId])
}

model GameSession {
  id                  String        @id @default(uuid())
  venueId             String
  venue               Venue         @relation(fields: [venueId], references: [id])
  date                DateTime      @db.Date
  startTime           String
  endTime             String
  playersNeeded       Int
  skillLevel          SkillLevel
  pricePerPlayerCents Int?                // 0 = free, null = split/negotiable
  notes               String?
  phone               String?             // same scrubbing + select rules as Listing
  status              SessionStatus @default(OPEN)
  editToken           String        @unique @default(uuid())
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  @@index([date, status])
  @@index([venueId])
}

model RateLimitEvent {
  id        String     @id @default(uuid())
  ipHash    String                        // SHA-256(ip + server salt); raw IPs never stored
  action    RateAction
  targetId  String?                       // listing/session id for per-target reveal limits
  createdAt DateTime   @default(now())

  @@index([ipHash, action, createdAt])
}

model ReportFlag {
  id         String   @id @default(uuid())
  targetType String                       // "listing" | "session"
  targetId   String
  ipHash     String
  createdAt  DateTime @default(now())

  @@index([targetType, targetId])
}

model VenueSuggestion {
  id        String   @id @default(uuid())
  name      String
  details   String?
  createdAt DateTime @default(now())
}
```

Notes:

- Two post types are separate models (not a `type` enum on one table) — their fields and
  status vocabularies differ, and each stays simple.
- `phone` is nullable **only** to support post-expiry scrubbing; creation validation requires it.

## 5. Time Handling

A court slot is a Singapore wall-clock fact. **No UTC conversion of court dates/times.**

- `date` is a date-only column meaning the SGT calendar date; `startTime`/`endTime` are SGT
  wall-clock strings. Singapore has no DST and a fixed offset since 1982.
- One module, `lib/time.ts`, owns all "now" logic: `todaySgt()`, `isPastDate(date)`,
  `timeBucket(startTime)` (morning/afternoon/evening). dayjs (with the timezone plugin,
  pinned to `Asia/Singapore`) is used only inside this module and for display formatting.
- `createdAt`/`updatedAt` remain normal UTC timestamps (machine facts, not court facts).

## 6. API & Services

### Conventions

- Every route handler returns `{ data, error }` (one of the two null), with appropriate
  HTTP status codes.
- **All Prisma access lives in `src/services/`** (venueService, listingService,
  sessionService, rateLimitService, reportService). Routes validate with Zod, call a
  service, shape the response. No inline queries.
- **Phone protection is structural:** services expose `PUBLIC_LISTING_SELECT` /
  `PUBLIC_SESSION_SELECT` objects that omit `phone` and `editToken`. Every list/detail
  query uses them. The phone column is read in exactly two places: the reveal service
  and the manage-token lookup. This guarantees numbers never appear in HTML, RSC
  payloads, or list JSON.

### Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/listings` | GET | Board query: `?date&region&venueId&time` (bucket) |
| `/api/listings` | POST | Create (Zod-validated, rate-limited, honeypot-checked) |
| `/api/listings/[id]` | GET | Public detail (public select) |
| `/api/listings/[id]/reveal` | POST | Rate-limited; returns `{ phone }` |
| `/api/listings/[id]/report` | POST | Insert ReportFlag (idempotent per ipHash) |
| `/api/sessions` + same sub-routes | | Mirror of the above with `?skill` filter |
| `/api/manage/[token]` | GET | Look up post by editToken (checks both tables) |
| `/api/manage/[token]` | PATCH | Mark SOLD / FILLED |
| `/api/manage/[token]` | DELETE | Delete post |
| `/api/venues` | GET | Seeded venue list (cacheable) |
| `/api/venue-suggestions` | POST | "Venue not listed" requests |

Manage mutations use PATCH/DELETE (not GET links) so tokens aren't triggered by prefetchers.

## 7. Lifecycle

- **Auto-expiry (on-read sweep):** before board queries, `updateMany` flips rows with
  `date < todaySgt()` to EXPIRED/past. No cron needed at this scale.
- **SOLD/FILLED visibility:** remain on the board (badged, sorted last) until their date
  passes, then expire like everything else.
- **PDPA phone scrubbing:** the same sweep nulls `phone` on rows expired more than 7 days
  ago. Personal data is retained only while it serves the transaction.

## 8. Security & Abuse (all measures are in-scope for MVP)

| Threat | Countermeasure |
|---|---|
| Bulk phone scraping | Phone only via reveal endpoint (§6); never in any page payload. Rate limits below. |
| Scraper walking the reveal endpoint | Per-IP **per-target** limit (same IP revealing many different posts fast = scraper) + generous global ceiling: 30 reveals/hr, 100/day per IP. Generous because Singapore mobile carriers use CGNAT — hundreds of legit users can share one IP courtside. |
| Spam / scripted posting | Create rate limit (5 posts/hr/IP), hidden honeypot field (bots fill it → silent 200, no insert), max 5 active posts per phone number, post dates restricted to today→+8 weeks. |
| Fake listings with someone else's number (harassment) | Strict SG phone validation (8 digits, starts with 8 or 9). Report button on every post → `ReportFlag` table for manual action. Accepted residual risk of no-OTP; **escalation path if abused: SMS OTP on posting** (documented, not built). |
| Manage-link leakage | editToken = UUIDv4 (unguessable). `noindex` meta + `X-Robots-Tag` on `/manage/*`. Pino redaction so manage URLs/tokens never hit logs. Mutations are PATCH/DELETE, immune to link prefetching. |
| XSS via notes/names | React auto-escaping only — `dangerouslySetInnerHTML` banned. Zod `max()` lengths on every text field. Notes rendered as plain text. |
| SQL injection | Prisma parameterized queries throughout; no raw SQL. |
| PDPA (SG data protection) | Only data collected: phone + post content. IPs stored **only** as salted SHA-256 hashes (`RateLimitEvent`, `ReportFlag`). Phones scrubbed 7 days post-expiry (§7). One-paragraph privacy note in the footer stating exactly this. |
| DoS | Vercel's platform protection; nothing custom. Cloudflare in front is the config-only escalation if ever needed. |
| Env/secret hygiene | Zod-validated `env.ts` fails the build on missing/malformed vars; secrets only in Vercel env, never committed. |

Rate limiting is implemented in **Postgres** (`RateLimitEvent` count-within-window per
ipHash/action/target) — correct across serverless instances, no Redis/extra infra. The
on-read sweep (§7) also deletes events older than 24h, keeping the table tiny.

## 9. Infrastructure & Operations

- **Vercel (Hobby) + Supabase (Free).** At ~1,000 users/day (≈20–50k requests/day) both
  free tiers hold comfortably; expected cost **$0/mo**. Growth triggers: Supabase Pro ($25)
  then Vercel Pro ($20) at roughly 10× traffic. (Vercel Hobby is non-commercial — fine
  while the app is free to use.)
- **Connection pooling (critical):** Prisma `datasource` uses Supabase's **pooled**
  connection string (pgbouncer, port 6543, `?pgbouncer=true&connection_limit=1`) with
  `directUrl` set to the direct connection (port 5432) for migrations. This is the #1
  Vercel+Supabase failure mode; it is config, set on day one.
- **Logging:** Pino JSON logs to stdout (Vercel log drain), with a redact list covering
  `phone`, `editToken`, and manage URLs.
- **Analytics:** Vercel Analytics (free tier) from day one so traffic is measurable.
- **Board queries stay dynamic** (no ISR/caching layers) — one indexed Postgres read is
  plenty at this scale. `/api/venues` may cache (venues change rarely).

## 10. Venue Seed Data

Seeded, curated venue table (free-text venues would destroy filtering):

- **ActiveSG sports halls** (~25): the primary set.
- **Community centres/clubs with bookable badminton courts** (major ones, expandable).
- **Dual-Use Scheme (DUS) school halls** — `venueType: SCHOOL`,
  `availabilityNote: "Weekends & school holidays only"` (or per-school specifics).
  The note renders as a badge on venue rows, cards, and detail pages.

Each entry: name, address, postal code, region (derived from postal district), type.
Gaps are filled over time via the in-app "Request a venue" flow (`VenueSuggestion`).

## 11. Testing Strategy

- **Playwright E2E, written early** (the core-loop regression net):
  1. Post court → success page → copy manage link → browse board → open detail →
     reveal phone → mark SOLD via manage link → verify badge.
  2. Shorter Players variant: post game → browse Players tab → skill filter → detail.
- **Jest unit:** services (expiry sweep, rate-limit windows, public-select omission of
  phone/editToken — an explicit test), `lib/time.ts` (SGT boundaries, buckets), Zod
  schemas (phone format, date range, honeypot).
- **RTL component:** filter bottom sheets, searchable venue combobox, date strip,
  listing card states (available/sold/free/negotiable).
- **TDD throughout** (superpowers:test-driven-development), **verify** skill against the
  real running app before completion claims, `/code-review` at the end.

## 12. Stack & Conventions (as decided)

Next.js App Router (latest) · TypeScript strict · Tailwind · Prisma + Supabase Postgres ·
Zod (validation + env) · dayjs (confined to `lib/time.ts` + formatting) · Pino ·
Jest + RTL + Playwright · Vercel deploy.

- Mobile-first UI, built with the **frontend-design** skill for a distinct look.
- `{ data, error }` API envelope everywhere; services own Prisma; routes stay thin.
- Incremental commits with meaningful messages; build artifacts (e.g.
  `tsconfig.tsbuildinfo`, `.next/`) gitignored; `.superpowers/` gitignored.
- Finish with `/init` so CLAUDE.md documents reality.

## 13. Future (explicitly deferred)

Player "looking for a game" reverse posts · SMS OTP (abuse escalation) · Telegram bot ·
notifications · moderation dashboard · venue geolocation/nearby · recurring sessions.
