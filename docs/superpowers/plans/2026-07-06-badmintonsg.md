# BadmintonSG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile-first, no-account listing board where SG badminton players resell balloted court slots (Courts) and recruit players for games (Players), with rate-limited phone reveal.

**Architecture:** Next.js App Router with server-component board pages; all Prisma access confined to `src/services/*`; Postgres-backed rate limiting; SGT wall-clock time handling confined to `src/lib/time.ts`; two sibling models (Listing, GameSession) sharing Venue, editToken-manage, and reveal patterns.

**Tech Stack:** Next.js 15 (App Router) · TypeScript strict · Tailwind · Prisma 6 + PostgreSQL (Supabase) · Zod · dayjs · Pino · Jest + React Testing Library · Playwright.

**Spec:** `docs/superpowers/specs/2026-07-06-badmintonsg-design.md` — read it before starting any task.

## Global Constraints

- TypeScript `strict: true`; no `any` unless unavoidable, no `dangerouslySetInnerHTML` anywhere.
- Every API route returns `{ data, error }` (exactly one non-null) via helpers in `src/lib/api.ts`.
- Prisma queries live ONLY in `src/services/*`. Routes: Zod-validate → call service → shape response.
- Public queries MUST use `PUBLIC_LISTING_SELECT` / `PUBLIC_SESSION_SELECT` (omit `phone`, `editToken`). `phone` is read only in reveal + manage services.
- Dates: `date` column is an SGT calendar date (`@db.Date`), times are `"HH:mm"` SGT wall-clock strings. All "now" logic goes through `src/lib/time.ts`. Never convert court dates to UTC.
- Prices in SGD cents: `0` = free, `null` = negotiable.
- SG phone validation: `/^[89]\d{7}$/`.
- Rate limits: reveal 3/hr per IP+target, 30/hr + 100/day per IP; create 5/hr per IP; max 5 active posts per phone per board.
- IPs stored only as `sha256(ip + IP_HASH_SALT)` hex.
- Post dates allowed: today → today+56 days (SGT).
- Design direction (for frontend-design skill): "court green" primary `#14532d` (Tailwind token `court`), accent `#dcfce7`, warm off-white bg `#fafaf7`, rounded-xl cards, mobile-first (design at 390px), system font stack with `font-semibold` venue names.
- Commit after every green test cycle. Never commit `.env`, `.next/`, `*.tsbuildinfo`, `node_modules/`.
- Commands below are for PowerShell/Git Bash on Windows; `npx` prefixes matter.

---

### Task 1: Scaffold project + tooling

**Files:**
- Create: entire Next.js app in repo root (`package.json`, `src/app/*`, `tsconfig.json`, `tailwind.config.ts`, …)
- Create: `docker-compose.yml`, `.env`, `.env.example`, `jest.config.ts`, `jest.setup.ts`
- Modify: `.gitignore` (append Next/Prisma entries if missing)

**Interfaces:**
- Produces: running dev server, `npm test` (Jest), `npm run test:e2e` (Playwright), local Postgres at `postgresql://postgres:postgres@localhost:5432/badmintonsg`

- [ ] **Step 1: Scaffold Next.js into the existing repo**

The repo already contains `docs/` and `.gitignore`. Scaffold in a temp dir and move in, or run in-place; in-place works when only non-conflicting files exist:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm --yes
```

If it refuses because the dir is non-empty, scaffold to `../bsg-tmp` and copy everything except `.git`, `docs`, `.gitignore` back, merging `.gitignore` entries manually.

- [ ] **Step 2: Install dependencies**

```bash
npm install prisma@^6 @prisma/client@^6 zod@^3.24 dayjs@^1.11 pino@^9
npm install -D jest@^29 jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest ts-node @playwright/test
npx playwright install chromium
```

- [ ] **Step 3: Enforce TS strict + Tailwind tokens**

Confirm `tsconfig.json` has `"strict": true`. In `tailwind.config.ts` extend the theme:

```ts
theme: {
  extend: {
    colors: {
      court: { DEFAULT: "#14532d", light: "#dcfce7" },
      paper: "#fafaf7",
    },
  },
},
```

- [ ] **Step 4: Local dev database**

Create `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: badmintonsg
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Run `docker compose up -d`. (No Docker? Point `DATABASE_URL` at a free Supabase project instead — everything else is identical.)

Create `.env` and `.env.example` (example uses the same values minus secrets):

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/badmintonsg"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/badmintonsg"
IP_HASH_SALT="dev-only-salt-change-in-prod"
```

- [ ] **Step 5: Jest config**

Create `jest.config.ts`:

```ts
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/e2e/", "<rootDir>/.next/"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};

export default createJestConfig(config);
```

Create `jest.setup.ts`:

```ts
import "@testing-library/jest-dom";
```

Add scripts to `package.json`:

```json
"test": "jest",
"test:watch": "jest --watch",
"test:e2e": "playwright test"
```

Note: service tests hit the real dev DB and run under Node, not jsdom — they carry a `@jest-environment node` docblock (shown in Task 7+).

- [ ] **Step 6: Verify dev server boots**

Run: `npm run dev` → open http://localhost:3000 → default Next page renders. Stop it. Run `npm test -- --passWithNoTests` → exits 0.

- [ ] **Step 7: Append to `.gitignore` and commit**

Ensure `.gitignore` covers: `node_modules/`, `.next/`, `*.tsbuildinfo`, `.env`, `coverage/`, `playwright-report/`, `test-results/`, `.superpowers/`.

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 + TS strict + Tailwind + test tooling"
```

---

### Task 2: Zod-validated env (`src/lib/env.ts`)

**Files:**
- Create: `src/lib/env.ts`
- Test: `src/lib/__tests__/env.test.ts`

**Interfaces:**
- Produces: `env: { DATABASE_URL: string; DIRECT_URL: string; IP_HASH_SALT: string }` — import `{ env } from "@/lib/env"` everywhere; nothing reads `process.env` directly except this file.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/env.test.ts`:

```ts
/** @jest-environment node */
import { envSchema } from "@/lib/env";

describe("envSchema", () => {
  const valid = {
    DATABASE_URL: "postgresql://u:p@h:5432/db",
    DIRECT_URL: "postgresql://u:p@h:5432/db",
    IP_HASH_SALT: "some-salt",
  };

  it("accepts valid env", () => {
    expect(envSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => envSchema.parse(rest)).toThrow();
  });

  it("rejects empty IP_HASH_SALT", () => {
    expect(() => envSchema.parse({ ...valid, IP_HASH_SALT: "" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- env.test` → FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/env.ts`**

```ts
import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  IP_HASH_SALT: z.string().min(1),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  IP_HASH_SALT: process.env.IP_HASH_SALT,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- env.test` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/lib/__tests__/env.test.ts
git commit -m "feat: zod-validated env"
```

---

### Task 3: Prisma schema, migration, client singleton

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`
- Modify: `package.json` (prisma seed hook placeholder added in Task 5)

**Interfaces:**
- Produces: `prisma` client singleton via `import { prisma } from "@/lib/db"`; all models/enums from spec §4.

- [ ] **Step 1: Write `prisma/schema.prisma`**

Copy the spec §4 model block verbatim, wrapped with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Then the enums (`Region`, `VenueType`, `ListingStatus`, `SessionStatus`, `SkillLevel`, `RateAction`) and models (`Venue`, `Listing`, `GameSession`, `RateLimitEvent`, `ReportFlag`, `VenueSuggestion`) exactly as written in spec §4 — including `@db.Date` on both `date` fields, `@unique` on both `editToken`s, and all `@@index` lines.

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name init`
Expected: migration applied, client generated, exit 0.

- [ ] **Step 3: Create `src/lib/db.ts` (singleton — prevents dev hot-reload connection leaks)**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Smoke-verify**

Run: `npx prisma studio` briefly (tables visible) or `npx tsx -e "import {prisma} from './src/lib/db'; prisma.venue.count().then(c=>{console.log(c);process.exit(0)})"` → prints `0`.

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: prisma schema + migration + client singleton"
```

---

### Task 4: SGT time utilities (`src/lib/time.ts`)

**Files:**
- Create: `src/lib/time.ts`
- Test: `src/lib/__tests__/time.test.ts`

**Interfaces:**
- Produces (used by services, schemas, and UI):
  - `todaySgt(): string` — `"YYYY-MM-DD"` for the current SGT calendar day
  - `maxPostDateSgt(): string` — today+56 days SGT
  - `dateToStr(d: Date): string` / `strToDate(s: string): Date` — DB `@db.Date` ↔ `"YYYY-MM-DD"` (UTC-midnight Date object)
  - `timeBucket(startTime: string): "MORNING" | "AFTERNOON" | "EVENING"`
  - `formatDateLabel(s: string): string` — `"Sat 14 Jun"`, with `"Today"`/`"Tmrw"` overrides
  - `formatPrice(cents: number | null): string` — `0 → "Free"`, `null → "Negotiable"`, `1600 → "$16"`, `1650 → "$16.50"`
  - `TIME_OPTIONS: string[]` — `"07:00"`…`"21:00"` hourly starts

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/time.test.ts`:

```ts
/** @jest-environment node */
import {
  todaySgt, maxPostDateSgt, dateToStr, strToDate,
  timeBucket, formatPrice,
} from "@/lib/time";

describe("time", () => {
  it("todaySgt returns YYYY-MM-DD", () => {
    expect(todaySgt()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("maxPostDateSgt is 56 days after today", () => {
    const ms = Date.parse(maxPostDateSgt()) - Date.parse(todaySgt());
    expect(ms).toBe(56 * 24 * 3600 * 1000);
  });

  it("round-trips date strings through Date objects", () => {
    expect(dateToStr(strToDate("2026-07-11"))).toBe("2026-07-11");
  });

  it("buckets times", () => {
    expect(timeBucket("08:00")).toBe("MORNING");
    expect(timeBucket("11:59")).toBe("MORNING");
    expect(timeBucket("12:00")).toBe("AFTERNOON");
    expect(timeBucket("17:59")).toBe("AFTERNOON");
    expect(timeBucket("18:00")).toBe("EVENING");
  });

  it("formats prices", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(null)).toBe("Negotiable");
    expect(formatPrice(1600)).toBe("$16");
    expect(formatPrice(1650)).toBe("$16.50");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- time.test` → FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/time.ts`**

```ts
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const SGT = "Asia/Singapore";
const FMT = "YYYY-MM-DD";

export function todaySgt(): string {
  return dayjs().tz(SGT).format(FMT);
}

export function maxPostDateSgt(): string {
  return dayjs().tz(SGT).add(56, "day").format(FMT);
}

/** DB @db.Date ↔ "YYYY-MM-DD". @db.Date stores a UTC-midnight Date. */
export function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function strToDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export type TimeBucket = "MORNING" | "AFTERNOON" | "EVENING";

export function timeBucket(startTime: string): TimeBucket {
  if (startTime < "12:00") return "MORNING";
  if (startTime < "18:00") return "AFTERNOON";
  return "EVENING";
}

export function formatDateLabel(s: string): string {
  const today = todaySgt();
  if (s === today) return "Today";
  if (s === dayjs(today).add(1, "day").format(FMT)) return "Tmrw";
  return dayjs(s).format("ddd D MMM");
}

export function formatPrice(cents: number | null): string {
  if (cents === null) return "Negotiable";
  if (cents === 0) return "Free";
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

export const TIME_OPTIONS = Array.from({ length: 15 }, (_, i) =>
  `${String(i + 7).padStart(2, "0")}:00`,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- time.test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.ts src/lib/__tests__/time.test.ts
git commit -m "feat: SGT time utilities"
```

---

### Task 5: Venue seed data

**Files:**
- Create: `prisma/venues.json`, `prisma/seed.ts`
- Modify: `package.json` (prisma seed hook)
- Test: `src/lib/__tests__/venues-data.test.ts`

**Interfaces:**
- Produces: seeded `Venue` rows; `prisma/venues.json` array of `{ name, address, postalCode, region, venueType, availabilityNote? }`.

- [ ] **Step 1: Write the failing data-integrity test**

`src/lib/__tests__/venues-data.test.ts`:

```ts
/** @jest-environment node */
import venues from "../../../prisma/venues.json";

const REGIONS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"];
const TYPES = ["SPORTS_HALL", "COMMUNITY_CENTRE", "SCHOOL", "OTHER"];

describe("venues.json", () => {
  it("has a meaningful set of venues", () => {
    expect(venues.length).toBeGreaterThanOrEqual(40);
  });

  it("every venue is well-formed", () => {
    for (const v of venues) {
      expect(v.name.length).toBeGreaterThan(2);
      expect(v.postalCode).toMatch(/^\d{6}$/);
      expect(REGIONS).toContain(v.region);
      expect(TYPES).toContain(v.venueType);
    }
  });

  it("schools carry an availability note", () => {
    for (const v of venues.filter((v) => v.venueType === "SCHOOL")) {
      expect(v.availabilityNote).toBeTruthy();
    }
  });

  it("has no duplicate names", () => {
    const names = venues.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
```

Add `"resolveJsonModule": true` to `tsconfig.json` compilerOptions if not present.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- venues-data` → FAIL (venues.json missing).

- [ ] **Step 3: Build `prisma/venues.json`**

Compile ≥40 real venues. Sources of truth: the ActiveSG sports-hall list and Dual-Use Scheme school list on activesg.gov.sg / sportsingapore.gov.sg (fetch during execution; if offline, use the well-known set below and mark the file for later verification). Must include at minimum these ActiveSG halls (region derived from postal district): Bedok, Bishan, Bukit Gombak, Choa Chu Kang, Clementi, Delta, Hougang, Jurong East, Jurong West, Pasir Ris, Sengkang, Tampines, Toa Payoh, Woodlands, Yio Chu Kang, Yishun, Serangoon, Queenstown — plus major CCs with bookable badminton courts and a representative set of DUS schools with `"availabilityNote": "Weekends & school holidays only"`.

Entry shape:

```json
{
  "name": "Choa Chu Kang Sport Hall",
  "address": "1 Choa Chu Kang Street 53",
  "postalCode": "689236",
  "region": "WEST",
  "venueType": "SPORTS_HALL"
}
```

- [ ] **Step 4: Write `prisma/seed.ts` (idempotent — upsert by name)**

```ts
import { PrismaClient, Region, VenueType } from "@prisma/client";
import venues from "./venues.json";

const prisma = new PrismaClient();

async function main() {
  for (const v of venues) {
    await prisma.venue.upsert({
      where: { name: v.name },
      update: { ...v, region: v.region as Region, venueType: v.venueType as VenueType },
      create: { ...v, region: v.region as Region, venueType: v.venueType as VenueType },
    });
  }
  console.log(`Seeded ${venues.length} venues`);
}

main().finally(() => prisma.$disconnect());
```

Upsert-by-name needs `name String @unique` on `Venue` — add `@unique` to the schema and run `npx prisma migrate dev --name venue-name-unique`. Add to `package.json`:

```json
"prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }
```

- [ ] **Step 5: Run seed + tests**

Run: `npx prisma db seed` → "Seeded N venues". Run again → same (idempotent). Run `npm test -- venues-data` → PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/lib/__tests__/venues-data.test.ts package.json tsconfig.json
git commit -m "feat: venue seed data (halls, CCs, DUS schools)"
```

---

### Task 6: Zod input schemas (`src/lib/schemas.ts`)

**Files:**
- Create: `src/lib/schemas.ts`
- Test: `src/lib/__tests__/schemas.test.ts`

**Interfaces:**
- Produces:
  - `createListingSchema` — `{ venueId: string(uuid), date, startTime, endTime, priceCents: number|null, notes?: string, phone, website?: string }` (`website` is the honeypot — must be empty/absent)
  - `createSessionSchema` — listing fields minus price plus `{ playersNeeded: 1..20, skillLevel: enum, pricePerPlayerCents: number|null }`
  - `boardFilterSchema` — `{ date?: string, region?: Region, venueId?: string, time?: TimeBucket, skill?: SkillLevel }` (all optional, from URL params)
  - `phoneSchema` — SG mobile regex
  - Types via `z.infer`: `CreateListingInput`, `CreateSessionInput`, `BoardFilters`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/schemas.test.ts`:

```ts
/** @jest-environment node */
import { createListingSchema, createSessionSchema, boardFilterSchema } from "@/lib/schemas";
import { todaySgt } from "@/lib/time";

const base = {
  venueId: "3f0e37f5-2f3a-4a4a-9d4a-111111111111",
  date: todaySgt(),
  startTime: "08:00",
  endTime: "10:00",
  phone: "91234567",
  website: "",
};

describe("createListingSchema", () => {
  it("accepts a valid listing", () => {
    const r = createListingSchema.safeParse({ ...base, priceCents: 1600 });
    expect(r.success).toBe(true);
  });

  it("accepts free (0) and negotiable (null) prices", () => {
    expect(createListingSchema.safeParse({ ...base, priceCents: 0 }).success).toBe(true);
    expect(createListingSchema.safeParse({ ...base, priceCents: null }).success).toBe(true);
  });

  it("rejects non-SG phones", () => {
    for (const phone of ["1234567", "612345678", "9123456", "+6591234567"]) {
      expect(createListingSchema.safeParse({ ...base, phone, priceCents: 0 }).success).toBe(false);
    }
  });

  it("rejects past dates and dates beyond 8 weeks", () => {
    expect(createListingSchema.safeParse({ ...base, date: "2020-01-01", priceCents: 0 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...base, date: "2099-01-01", priceCents: 0 }).success).toBe(false);
  });

  it("rejects endTime <= startTime", () => {
    expect(createListingSchema.safeParse({ ...base, startTime: "10:00", endTime: "08:00", priceCents: 0 }).success).toBe(false);
  });

  it("rejects filled honeypot", () => {
    expect(createListingSchema.safeParse({ ...base, website: "spam.com", priceCents: 0 }).success).toBe(false);
  });

  it("caps notes at 300 chars", () => {
    expect(createListingSchema.safeParse({ ...base, notes: "x".repeat(301), priceCents: 0 }).success).toBe(false);
  });
});

describe("createSessionSchema", () => {
  it("accepts a valid session", () => {
    const r = createSessionSchema.safeParse({
      ...base, playersNeeded: 2, skillLevel: "INTERMEDIATE", pricePerPlayerCents: 400,
    });
    expect(r.success).toBe(true);
  });

  it("rejects playersNeeded out of range", () => {
    for (const playersNeeded of [0, 21]) {
      expect(createSessionSchema.safeParse({
        ...base, playersNeeded, skillLevel: "BEGINNER", pricePerPlayerCents: null,
      }).success).toBe(false);
    }
  });
});

describe("boardFilterSchema", () => {
  it("parses empty filters", () => {
    expect(boardFilterSchema.parse({})).toEqual({});
  });

  it("drops invalid values rather than crashing the board", () => {
    const r = boardFilterSchema.safeParse({ region: "MOON" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- schemas.test` → FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/schemas.ts`**

```ts
import { z } from "zod";
import { todaySgt, maxPostDateSgt } from "@/lib/time";

export const phoneSchema = z
  .string()
  .regex(/^[89]\d{7}$/, "Enter an 8-digit SG mobile number starting with 8 or 9");

const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const dateInRange = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => d >= todaySgt() && d <= maxPostDateSgt(), {
    message: "Date must be between today and 8 weeks from now",
  });

const honeypot = z
  .string()
  .max(0, "spam")
  .optional()
  .or(z.literal(""));

const postBase = z.object({
  venueId: z.string().uuid(),
  date: dateInRange,
  startTime: timeStr,
  endTime: timeStr,
  notes: z.string().max(300).optional(),
  phone: phoneSchema,
  website: honeypot, // honeypot: real users never see or fill this
});

const timeOrder = (v: { startTime: string; endTime: string }) => v.endTime > v.startTime;
const TIME_ORDER_MSG = { message: "End time must be after start time", path: ["endTime"] };

export const createListingSchema = postBase
  .extend({ priceCents: z.number().int().min(0).max(50_000).nullable() })
  .refine(timeOrder, TIME_ORDER_MSG);

export const createSessionSchema = postBase
  .extend({
    playersNeeded: z.number().int().min(1).max(20),
    skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    pricePerPlayerCents: z.number().int().min(0).max(50_000).nullable(),
  })
  .refine(timeOrder, TIME_ORDER_MSG);

export const boardFilterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  region: z.enum(["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"]).optional(),
  venueId: z.string().uuid().optional(),
  time: z.enum(["MORNING", "AFTERNOON", "EVENING"]).optional(),
  skill: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type BoardFilters = z.infer<typeof boardFilterSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- schemas.test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas.ts src/lib/__tests__/schemas.test.ts
git commit -m "feat: zod input schemas (posts, filters, honeypot, SG phone)"
```

---

### Task 7: IP hashing + rate-limit service

**Files:**
- Create: `src/lib/ip.ts`, `src/services/rateLimitService.ts`, `src/lib/__tests__/helpers/db.ts`
- Test: `src/lib/__tests__/ip.test.ts`, `src/services/__tests__/rateLimitService.test.ts`

**Interfaces:**
- Produces:
  - `hashIp(ip: string): string` — sha256 hex of `ip + IP_HASH_SALT`
  - `getClientIp(req: Request): string` — first `x-forwarded-for` entry, else `"unknown"`
  - `assertCreateAllowed(ipHash: string): Promise<void>` — throws `RateLimitError` over 5 creates/hr
  - `assertRevealAllowed(ipHash: string, targetId: string): Promise<void>` — throws over 3/hr per target, 30/hr or 100/day global; **records the event when allowed**
  - `recordCreate(ipHash: string): Promise<void>`
  - `class RateLimitError extends Error` (routes map it to HTTP 429)
  - Test helper `resetDb()` truncating all tables (used by every service test)

Service tests hit the real dev DB (Task 1 docker Postgres). They run serially: add `"test": "jest --runInBand"` to package.json scripts (replaces the Task 1 value).

- [ ] **Step 1: Write the DB test helper**

`src/lib/__tests__/helpers/db.ts`:

```ts
import { prisma } from "@/lib/db";

export async function resetDb() {
  // Order matters only for FK targets; venue-dependent tables first.
  await prisma.reportFlag.deleteMany();
  await prisma.rateLimitEvent.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.venueSuggestion.deleteMany();
  await prisma.venue.deleteMany();
}

export async function makeVenue(name = "Test Hall") {
  return prisma.venue.create({
    data: {
      name, address: "1 Test St", postalCode: "123456",
      region: "WEST", venueType: "SPORTS_HALL",
    },
  });
}
```

- [ ] **Step 2: Write failing tests**

`src/lib/__tests__/ip.test.ts`:

```ts
/** @jest-environment node */
import { hashIp, getClientIp } from "@/lib/ip";

describe("ip", () => {
  it("hashIp is deterministic, salted, and not the raw ip", () => {
    const h = hashIp("1.2.3.4");
    expect(h).toBe(hashIp("1.2.3.4"));
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).not.toContain("1.2.3.4");
  });

  it("getClientIp reads first x-forwarded-for entry", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("getClientIp falls back to 'unknown'", () => {
    expect(getClientIp(new Request("http://x"))).toBe("unknown");
  });
});
```

`src/services/__tests__/rateLimitService.test.ts`:

```ts
/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb } from "@/lib/__tests__/helpers/db";
import {
  assertCreateAllowed, assertRevealAllowed, recordCreate, RateLimitError,
} from "@/services/rateLimitService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("rateLimitService", () => {
  it("allows 5 creates then blocks the 6th", async () => {
    for (let i = 0; i < 5; i++) {
      await assertCreateAllowed("hashA");
      await recordCreate("hashA");
    }
    await expect(assertCreateAllowed("hashA")).rejects.toThrow(RateLimitError);
    await expect(assertCreateAllowed("hashB")).resolves.toBeUndefined();
  });

  it("blocks 4th reveal of the same target for one ip", async () => {
    for (let i = 0; i < 3; i++) await assertRevealAllowed("hashA", "target1");
    await expect(assertRevealAllowed("hashA", "target1")).rejects.toThrow(RateLimitError);
    // different target still fine
    await expect(assertRevealAllowed("hashA", "target2")).resolves.toBeUndefined();
  });

  it("blocks after 30 reveals across targets in an hour", async () => {
    for (let i = 0; i < 30; i++) await assertRevealAllowed("hashA", `t${i}`);
    await expect(assertRevealAllowed("hashA", "t99")).rejects.toThrow(RateLimitError);
  });

  it("ignores events outside the window", async () => {
    const old = new Date(Date.now() - 2 * 3600 * 1000);
    await prisma.rateLimitEvent.createMany({
      data: Array.from({ length: 5 }, () => ({ ipHash: "hashA", action: "CREATE" as const, createdAt: old })),
    });
    await expect(assertCreateAllowed("hashA")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- ip.test rateLimitService` → FAIL (modules not found).

- [ ] **Step 4: Implement `src/lib/ip.ts`**

```ts
import { createHash } from "crypto";
import { env } from "@/lib/env";

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip + env.IP_HASH_SALT).digest("hex");
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
```

- [ ] **Step 5: Implement `src/services/rateLimitService.ts`**

```ts
import { RateAction } from "@prisma/client";
import { prisma } from "@/lib/db";

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests — try again later");
    this.name = "RateLimitError";
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function since(ms: number): Date {
  return new Date(Date.now() - ms);
}

async function countEvents(opts: {
  ipHash: string; action: RateAction; windowMs: number; targetId?: string;
}): Promise<number> {
  return prisma.rateLimitEvent.count({
    where: {
      ipHash: opts.ipHash,
      action: opts.action,
      createdAt: { gte: since(opts.windowMs) },
      ...(opts.targetId ? { targetId: opts.targetId } : {}),
    },
  });
}

export async function assertCreateAllowed(ipHash: string): Promise<void> {
  if ((await countEvents({ ipHash, action: "CREATE", windowMs: HOUR })) >= 5) {
    throw new RateLimitError();
  }
}

export async function recordCreate(ipHash: string): Promise<void> {
  await prisma.rateLimitEvent.create({ data: { ipHash, action: "CREATE" } });
}

/** Checks per-target + global reveal limits, and records the event when allowed. */
export async function assertRevealAllowed(ipHash: string, targetId: string): Promise<void> {
  const [perTarget, hourly, daily] = await Promise.all([
    countEvents({ ipHash, action: "REVEAL", windowMs: HOUR, targetId }),
    countEvents({ ipHash, action: "REVEAL", windowMs: HOUR }),
    countEvents({ ipHash, action: "REVEAL", windowMs: DAY }),
  ]);
  if (perTarget >= 3 || hourly >= 30 || daily >= 100) throw new RateLimitError();
  await prisma.rateLimitEvent.create({ data: { ipHash, action: "REVEAL", targetId } });
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- ip.test rateLimitService` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ip.ts src/services/rateLimitService.ts src/lib/__tests__/ src/services/__tests__/ package.json
git commit -m "feat: hashed-ip rate limiting (postgres-backed, CGNAT-aware)"
```

---

### Task 8: Listing service (create, board query, sweep, reveal)

**Files:**
- Create: `src/services/listingService.ts`
- Test: `src/services/__tests__/listingService.test.ts`

**Interfaces:**
- Consumes: `prisma`, `CreateListingInput`, `BoardFilters`, time utils, `resetDb`/`makeVenue` helper.
- Produces:
  - `PUBLIC_LISTING_SELECT` — select object omitting `phone` + `editToken`, including `venue: { select: { id, name, region, venueType, availabilityNote } }`
  - `PublicListing` type (inferred via `Prisma.ListingGetPayload<{ select: typeof PUBLIC_LISTING_SELECT }>`)
  - `sweepExpired(): Promise<void>` — expires past posts (both tables), scrubs phones >7 days past, deletes rate-limit events >24h
  - `listListings(filters: BoardFilters): Promise<PublicListing[]>` — runs sweep first; default date = today; AVAILABLE first then SOLD, by startTime
  - `getListing(id: string): Promise<PublicListing | null>`
  - `createListing(input: CreateListingInput): Promise<{ id: string; editToken: string }>` — throws `ActivePostCapError` at 5 active posts per phone
  - `revealListingPhone(id: string): Promise<string | null>`
  - `class ActivePostCapError extends Error`

- [ ] **Step 1: Write failing tests**

`src/services/__tests__/listingService.test.ts`:

```ts
/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt, strToDate } from "@/lib/time";
import {
  createListing, listListings, getListing, revealListingPhone,
  sweepExpired, ActivePostCapError,
} from "@/services/listingService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const input = (venueId: string, over: Record<string, unknown> = {}) => ({
  venueId, date: todaySgt(), startTime: "08:00", endTime: "10:00",
  priceCents: 1600, phone: "91234567", ...over,
}) as Parameters<typeof createListing>[0];

describe("listingService", () => {
  it("creates and returns id + editToken; board payload has no phone/editToken", async () => {
    const venue = await makeVenue();
    const { id, editToken } = await createListing(input(venue.id));
    expect(editToken).toMatch(/^[0-9a-f-]{36}$/);

    const rows = await listListings({});
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0]).not.toHaveProperty("phone");
    expect(rows[0]).not.toHaveProperty("editToken");
    expect(rows[0].venue.name).toBe("Test Hall");

    const detail = await getListing(id);
    expect(detail).not.toHaveProperty("phone");
  });

  it("filters by region, venue, and time bucket", async () => {
    const west = await makeVenue("West Hall");
    const east = await prisma.venue.create({
      data: { name: "East Hall", address: "2 E St", postalCode: "469000", region: "EAST", venueType: "SPORTS_HALL" },
    });
    await createListing(input(west.id, { startTime: "08:00", endTime: "10:00" }));
    await createListing(input(east.id, { startTime: "18:00", endTime: "20:00" }));

    expect(await listListings({ region: "EAST" })).toHaveLength(1);
    expect(await listListings({ venueId: west.id })).toHaveLength(1);
    expect(await listListings({ time: "EVENING" })).toHaveLength(1);
    expect(await listListings({ time: "MORNING" })).toHaveLength(1);
  });

  it("enforces max 5 active listings per phone", async () => {
    const venue = await makeVenue();
    for (let i = 0; i < 5; i++) await createListing(input(venue.id));
    await expect(createListing(input(venue.id))).rejects.toThrow(ActivePostCapError);
    await expect(createListing(input(venue.id, { phone: "81234567" }))).resolves.toBeTruthy();
  });

  it("sweep expires past listings and scrubs old phones", async () => {
    const venue = await makeVenue();
    const { id: oldId } = await createListing(input(venue.id));
    const { id: veryOldId } = await createListing(input(venue.id, { phone: "81111111" }));
    // Backdate via raw update (service forbids past dates at create time)
    await prisma.listing.update({ where: { id: oldId }, data: { date: strToDate("2026-07-01") } });
    await prisma.listing.update({ where: { id: veryOldId }, data: { date: strToDate("2026-06-01") } });

    await sweepExpired();

    const old = await prisma.listing.findUniqueOrThrow({ where: { id: oldId } });
    expect(old.status).toBe("EXPIRED");
    expect(old.phone).toBe("91234567"); // <7 days past: kept
    const veryOld = await prisma.listing.findUniqueOrThrow({ where: { id: veryOldId } });
    expect(veryOld.status).toBe("EXPIRED");
    expect(veryOld.phone).toBeNull(); // >7 days past: scrubbed
  });

  it("board hides expired, keeps SOLD visible sorted last", async () => {
    const venue = await makeVenue();
    const { id: soldId } = await createListing(input(venue.id, { startTime: "07:00", endTime: "09:00" }));
    await createListing(input(venue.id, { phone: "81234567" }));
    await prisma.listing.update({ where: { id: soldId }, data: { status: "SOLD" } });

    const rows = await listListings({ date: todaySgt() });
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("AVAILABLE");
    expect(rows[1].status).toBe("SOLD");
  });

  it("reveal returns the phone", async () => {
    const venue = await makeVenue();
    const { id } = await createListing(input(venue.id));
    expect(await revealListingPhone(id)).toBe("91234567");
  });
});
```

Note: the very-old-date backdate values assume execution in July 2026; compute them from `todaySgt()` minus 3 / 40 days with dayjs at execution time if this plan is executed later — the assertion logic (kept vs scrubbed) is what matters.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- listingService` → FAIL (module not found).

- [ ] **Step 3: Implement `src/services/listingService.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todaySgt, strToDate } from "@/lib/time";
import type { BoardFilters, CreateListingInput } from "@/lib/schemas";

export class ActivePostCapError extends Error {
  constructor() {
    super("This phone number already has 5 active posts");
    this.name = "ActivePostCapError";
  }
}

export const PUBLIC_LISTING_SELECT = {
  id: true, date: true, startTime: true, endTime: true,
  priceCents: true, notes: true, status: true, createdAt: true,
  venue: {
    select: { id: true, name: true, region: true, venueType: true, availabilityNote: true },
  },
} satisfies Prisma.ListingSelect;

export type PublicListing = Prisma.ListingGetPayload<{ select: typeof PUBLIC_LISTING_SELECT }>;

const DAY_MS = 24 * 3600 * 1000;

/** On-read sweep: expire past posts, scrub stale phones, prune rate-limit events. */
export async function sweepExpired(): Promise<void> {
  const today = strToDate(todaySgt());
  const scrubBefore = new Date(today.getTime() - 7 * DAY_MS);
  const pruneBefore = new Date(Date.now() - DAY_MS);

  await Promise.all([
    prisma.listing.updateMany({
      where: { date: { lt: today }, status: { not: "EXPIRED" } },
      data: { status: "EXPIRED" },
    }),
    prisma.gameSession.updateMany({
      where: { date: { lt: today }, status: { not: "EXPIRED" } },
      data: { status: "EXPIRED" },
    }),
    prisma.listing.updateMany({
      where: { date: { lt: scrubBefore }, phone: { not: null } },
      data: { phone: null },
    }),
    prisma.gameSession.updateMany({
      where: { date: { lt: scrubBefore }, phone: { not: null } },
      data: { phone: null },
    }),
    prisma.rateLimitEvent.deleteMany({ where: { createdAt: { lt: pruneBefore } } }),
  ]);
}

export const TIME_RANGES = {
  MORNING: { lt: "12:00" },
  AFTERNOON: { gte: "12:00", lt: "18:00" },
  EVENING: { gte: "18:00" },
} as const;

export async function listListings(filters: BoardFilters): Promise<PublicListing[]> {
  await sweepExpired();
  return prisma.listing.findMany({
    where: {
      date: strToDate(filters.date ?? todaySgt()),
      status: { in: ["AVAILABLE", "SOLD"] },
      ...(filters.venueId ? { venueId: filters.venueId } : {}),
      ...(filters.region ? { venue: { region: filters.region } } : {}),
      ...(filters.time ? { startTime: TIME_RANGES[filters.time] } : {}),
    },
    select: PUBLIC_LISTING_SELECT,
    orderBy: [{ status: "asc" }, { startTime: "asc" }], // AVAILABLE < SOLD alphabetically
  });
}

export async function getListing(id: string): Promise<PublicListing | null> {
  return prisma.listing.findUnique({ where: { id }, select: PUBLIC_LISTING_SELECT });
}

export async function createListing(
  input: CreateListingInput,
): Promise<{ id: string; editToken: string }> {
  const active = await prisma.listing.count({
    where: { phone: input.phone, status: "AVAILABLE" },
  });
  if (active >= 5) throw new ActivePostCapError();

  const row = await prisma.listing.create({
    data: {
      venueId: input.venueId,
      date: strToDate(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      priceCents: input.priceCents,
      notes: input.notes,
      phone: input.phone,
    },
    select: { id: true, editToken: true },
  });
  return row;
}

export async function revealListingPhone(id: string): Promise<string | null> {
  const row = await prisma.listing.findUnique({ where: { id }, select: { phone: true } });
  return row?.phone ?? null;
}
```

`orderBy status asc` works because `AVAILABLE` < `SOLD` alphabetically — leave the comment in place; if the enum ever changes, sorting must change too.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- listingService` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/listingService.ts src/services/__tests__/listingService.test.ts
git commit -m "feat: listing service with sweep, public select, per-phone cap"
```

---

### Task 9: Session service + manage service

**Files:**
- Create: `src/services/sessionService.ts`, `src/services/manageService.ts`
- Test: `src/services/__tests__/sessionService.test.ts`, `src/services/__tests__/manageService.test.ts`

**Interfaces:**
- Consumes: `prisma`, `CreateSessionInput`, `BoardFilters`, time utils, `sweepExpired` (from listingService — it already covers both tables), `ActivePostCapError` (re-used).
- Produces:
  - `PUBLIC_SESSION_SELECT` / `PublicSession` — like listing's, adding `playersNeeded`, `skillLevel`, `pricePerPlayerCents`
  - `listSessions(filters: BoardFilters): Promise<PublicSession[]>` (supports `skill` filter; OPEN before FILLED)
  - `getSession(id)`, `createSession(input)`, `revealSessionPhone(id)` — mirrors of the listing versions
  - `findPostByToken(token: string): Promise<{ type: "listing" | "session"; post: { id, date, startTime, endTime, status, venueName } } | null>`
  - `closePostByToken(token: string): Promise<boolean>` — sets SOLD (listing) / FILLED (session); false if token unknown
  - `deletePostByToken(token: string): Promise<boolean>`

- [ ] **Step 1: Write failing tests**

`src/services/__tests__/sessionService.test.ts`:

```ts
/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt } from "@/lib/time";
import { createSession, listSessions, revealSessionPhone } from "@/services/sessionService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const input = (venueId: string, over: Record<string, unknown> = {}) => ({
  venueId, date: todaySgt(), startTime: "18:00", endTime: "20:00",
  playersNeeded: 2, skillLevel: "INTERMEDIATE", pricePerPlayerCents: 400,
  phone: "91234567", ...over,
}) as Parameters<typeof createSession>[0];

describe("sessionService", () => {
  it("creates; board payload includes session fields, no phone/editToken", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id));
    const rows = await listSessions({});
    expect(rows).toHaveLength(1);
    expect(rows[0].playersNeeded).toBe(2);
    expect(rows[0].skillLevel).toBe("INTERMEDIATE");
    expect(rows[0]).not.toHaveProperty("phone");
    expect(rows[0]).not.toHaveProperty("editToken");
  });

  it("filters by skill", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id));
    await createSession(input(venue.id, { skillLevel: "BEGINNER", phone: "81234567" }));
    expect(await listSessions({ skill: "BEGINNER" })).toHaveLength(1);
  });

  it("reveals phone", async () => {
    const venue = await makeVenue();
    const { id } = await createSession(input(venue.id));
    expect(await revealSessionPhone(id)).toBe("91234567");
  });
});
```

`src/services/__tests__/manageService.test.ts`:

```ts
/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt } from "@/lib/time";
import { createListing } from "@/services/listingService";
import { createSession } from "@/services/sessionService";
import { findPostByToken, closePostByToken, deletePostByToken } from "@/services/manageService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("manageService", () => {
  it("finds either post type by token; null for unknown", async () => {
    const venue = await makeVenue();
    const l = await createListing({
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 0, phone: "91234567",
    });
    const s = await createSession({
      venueId: venue.id, date: todaySgt(), startTime: "18:00", endTime: "20:00",
      playersNeeded: 2, skillLevel: "BEGINNER", pricePerPlayerCents: null, phone: "81234567",
    });

    expect((await findPostByToken(l.editToken))?.type).toBe("listing");
    expect((await findPostByToken(s.editToken))?.type).toBe("session");
    expect(await findPostByToken("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("closes: listing → SOLD, session → FILLED", async () => {
    const venue = await makeVenue();
    const l = await createListing({
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 0, phone: "91234567",
    });
    expect(await closePostByToken(l.editToken)).toBe(true);
    const row = await prisma.listing.findFirstOrThrow();
    expect(row.status).toBe("SOLD");
    expect(await closePostByToken("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("deletes by token", async () => {
    const venue = await makeVenue();
    const l = await createListing({
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 0, phone: "91234567",
    });
    expect(await deletePostByToken(l.editToken)).toBe(true);
    expect(await prisma.listing.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- sessionService manageService` → FAIL.

- [ ] **Step 3: Implement `src/services/sessionService.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todaySgt, strToDate } from "@/lib/time";
import type { BoardFilters, CreateSessionInput } from "@/lib/schemas";
import { ActivePostCapError, sweepExpired, TIME_RANGES } from "@/services/listingService";

export const PUBLIC_SESSION_SELECT = {
  id: true, date: true, startTime: true, endTime: true,
  playersNeeded: true, skillLevel: true, pricePerPlayerCents: true,
  notes: true, status: true, createdAt: true,
  venue: {
    select: { id: true, name: true, region: true, venueType: true, availabilityNote: true },
  },
} satisfies Prisma.GameSessionSelect;

export type PublicSession = Prisma.GameSessionGetPayload<{ select: typeof PUBLIC_SESSION_SELECT }>;

export async function listSessions(filters: BoardFilters): Promise<PublicSession[]> {
  await sweepExpired();
  return prisma.gameSession.findMany({
    where: {
      date: strToDate(filters.date ?? todaySgt()),
      status: { in: ["OPEN", "FILLED"] },
      ...(filters.venueId ? { venueId: filters.venueId } : {}),
      ...(filters.region ? { venue: { region: filters.region } } : {}),
      ...(filters.time ? { startTime: TIME_RANGES[filters.time] } : {}),
      ...(filters.skill ? { skillLevel: filters.skill } : {}),
    },
    select: PUBLIC_SESSION_SELECT,
    orderBy: [{ status: "desc" }, { startTime: "asc" }], // OPEN > FILLED alphabetically → desc puts OPEN first
  });
}

export async function getSession(id: string): Promise<PublicSession | null> {
  return prisma.gameSession.findUnique({ where: { id }, select: PUBLIC_SESSION_SELECT });
}

export async function createSession(
  input: CreateSessionInput,
): Promise<{ id: string; editToken: string }> {
  const active = await prisma.gameSession.count({
    where: { phone: input.phone, status: "OPEN" },
  });
  if (active >= 5) throw new ActivePostCapError();

  return prisma.gameSession.create({
    data: {
      venueId: input.venueId,
      date: strToDate(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      playersNeeded: input.playersNeeded,
      skillLevel: input.skillLevel,
      pricePerPlayerCents: input.pricePerPlayerCents,
      notes: input.notes,
      phone: input.phone,
    },
    select: { id: true, editToken: true },
  });
}

export async function revealSessionPhone(id: string): Promise<string | null> {
  const row = await prisma.gameSession.findUnique({ where: { id }, select: { phone: true } });
  return row?.phone ?? null;
}
```

- [ ] **Step 4: Implement `src/services/manageService.ts`**

```ts
import { prisma } from "@/lib/db";
import { dateToStr } from "@/lib/time";

export type ManagedPost = {
  type: "listing" | "session";
  post: {
    id: string; date: string; startTime: string; endTime: string;
    status: string; venueName: string;
  };
};

const MANAGE_SELECT = {
  id: true, date: true, startTime: true, endTime: true, status: true,
  venue: { select: { name: true } },
} as const;

export async function findPostByToken(token: string): Promise<ManagedPost | null> {
  const listing = await prisma.listing.findUnique({
    where: { editToken: token }, select: MANAGE_SELECT,
  });
  if (listing) {
    return {
      type: "listing",
      post: {
        id: listing.id, date: dateToStr(listing.date),
        startTime: listing.startTime, endTime: listing.endTime,
        status: listing.status, venueName: listing.venue.name,
      },
    };
  }
  const session = await prisma.gameSession.findUnique({
    where: { editToken: token }, select: MANAGE_SELECT,
  });
  if (session) {
    return {
      type: "session",
      post: {
        id: session.id, date: dateToStr(session.date),
        startTime: session.startTime, endTime: session.endTime,
        status: session.status, venueName: session.venue.name,
      },
    };
  }
  return null;
}

export async function closePostByToken(token: string): Promise<boolean> {
  const found = await findPostByToken(token);
  if (!found) return false;
  if (found.type === "listing") {
    await prisma.listing.update({ where: { editToken: token }, data: { status: "SOLD" } });
  } else {
    await prisma.gameSession.update({ where: { editToken: token }, data: { status: "FILLED" } });
  }
  return true;
}

export async function deletePostByToken(token: string): Promise<boolean> {
  const found = await findPostByToken(token);
  if (!found) return false;
  if (found.type === "listing") {
    await prisma.listing.delete({ where: { editToken: token } });
  } else {
    await prisma.gameSession.delete({ where: { editToken: token } });
  }
  return true;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- sessionService manageService` → PASS. Then full suite: `npm test` → all green.

- [ ] **Step 6: Commit**

```bash
git add src/services/
git commit -m "feat: session + manage services"
```

---

### Task 10: API routes — envelope helper + all endpoints

**Files:**
- Create: `src/lib/api.ts`, `src/services/venueService.ts`, `src/services/reportService.ts`
- Create routes: `src/app/api/venues/route.ts`, `src/app/api/venue-suggestions/route.ts`, `src/app/api/listings/route.ts`, `src/app/api/listings/[id]/route.ts`, `src/app/api/listings/[id]/reveal/route.ts`, `src/app/api/listings/[id]/report/route.ts`, `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/route.ts`, `src/app/api/sessions/[id]/reveal/route.ts`, `src/app/api/sessions/[id]/report/route.ts`, `src/app/api/manage/[token]/route.ts`
- Test: `src/lib/__tests__/api.test.ts`, `src/app/api/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: every service from Tasks 7–9.
- Produces (route handlers are plain functions — testable by calling them with a `Request`):
  - `ok(data: unknown, status = 200): Response` → `{ data, error: null }`
  - `fail(message: string, status: number): Response` → `{ data: null, error: message }`
  - `handleError(e: unknown): Response` — maps `ZodError`→400, `RateLimitError`→429, `ActivePostCapError`→409, else 500 (generic message, never `e.message` for unknown errors)
  - HTTP surface exactly as spec §6 table.

- [ ] **Step 1: Write failing tests**

`src/lib/__tests__/api.test.ts`:

```ts
/** @jest-environment node */
import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api";
import { RateLimitError } from "@/services/rateLimitService";
import { ActivePostCapError } from "@/services/listingService";

describe("api envelope", () => {
  it("ok wraps data", async () => {
    const res = ok({ x: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { x: 1 }, error: null });
  });

  it("fail wraps error", async () => {
    const res = fail("nope", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ data: null, error: "nope" });
  });

  it("handleError maps known errors", async () => {
    expect(handleError(new RateLimitError()).status).toBe(429);
    expect(handleError(new ActivePostCapError()).status).toBe(409);
    const zerr = z.string().safeParse(1);
    expect(handleError(!zerr.success ? zerr.error : null).status).toBe(400);
    const res = handleError(new Error("secret db string"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Something went wrong");
  });
});
```

`src/app/api/__tests__/routes.test.ts` (integration: real handlers, real dev DB):

```ts
/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt } from "@/lib/time";
import { POST as createListingRoute, GET as listListingsRoute } from "@/app/api/listings/route";
import { POST as revealRoute } from "@/app/api/listings/[id]/reveal/route";
import { GET as manageGet, PATCH as managePatch, DELETE as manageDelete } from "@/app/api/manage/[token]/route";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function req(url: string, method: string, body?: unknown, ip = "1.2.3.4") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

describe("listings API", () => {
  it("POST create → GET board (no phone) → reveal → manage close → delete", async () => {
    const venue = await makeVenue();
    const body = {
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 1600, phone: "91234567", website: "",
    };

    const createRes = await createListingRoute(req("http://x/api/listings", "POST", body));
    expect(createRes.status).toBe(201);
    const { data } = await createRes.json();
    expect(data.editToken).toBeTruthy();

    const listRes = await listListingsRoute(new Request(`http://x/api/listings?date=${todaySgt()}`));
    const list = await listRes.json();
    expect(list.data).toHaveLength(1);
    expect(JSON.stringify(list.data)).not.toContain("91234567");

    const revealRes = await revealRoute(req(`http://x/api/listings/${data.id}/reveal`, "POST"), params({ id: data.id }));
    expect((await revealRes.json()).data.phone).toBe("91234567");

    const mg = await manageGet(req(`http://x/api/manage/${data.editToken}`, "GET"), params({ token: data.editToken }));
    expect((await mg.json()).data.type).toBe("listing");

    const mp = await managePatch(req(`http://x/api/manage/${data.editToken}`, "PATCH"), params({ token: data.editToken }));
    expect(mp.status).toBe(200);
    expect((await prisma.listing.findFirstOrThrow()).status).toBe("SOLD");

    const md = await manageDelete(req(`http://x/api/manage/${data.editToken}`, "DELETE"), params({ token: data.editToken }));
    expect(md.status).toBe(200);
    expect(await prisma.listing.count()).toBe(0);
  });

  it("rejects invalid body with 400 envelope", async () => {
    const res = await createListingRoute(req("http://x/api/listings", "POST", { phone: "123" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.data).toBeNull();
    expect(typeof json.error).toBe("string");
  });

  it("honeypot returns 201 but writes nothing", async () => {
    const venue = await makeVenue();
    const res = await createListingRoute(req("http://x/api/listings", "POST", {
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 0, phone: "91234567", website: "http://spam.example",
    }));
    expect(res.status).toBe(201);
    expect(await prisma.listing.count()).toBe(0);
  });

  it("manage 404s for unknown token", async () => {
    const t = "00000000-0000-0000-0000-000000000000";
    const res = await manageGet(req(`http://x/api/manage/${t}`, "GET"), params({ token: t }));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- api.test routes.test` → FAIL.

- [ ] **Step 3: Implement `src/lib/api.ts`**

```ts
import { ZodError } from "zod";
import { RateLimitError } from "@/services/rateLimitService";
import { ActivePostCapError } from "@/services/listingService";

export function ok(data: unknown, status = 200): Response {
  return Response.json({ data, error: null }, { status });
}

export function fail(message: string, status: number): Response {
  return Response.json({ data: null, error: message }, { status });
}

export function handleError(e: unknown): Response {
  if (e instanceof ZodError) {
    return fail(e.issues[0]?.message ?? "Invalid input", 400);
  }
  if (e instanceof RateLimitError) return fail(e.message, 429);
  if (e instanceof ActivePostCapError) return fail(e.message, 409);
  console.error(e); // replaced by pino logger in Task 16
  return fail("Something went wrong", 500);
}
```

- [ ] **Step 4: Implement small services**

`src/services/venueService.ts`:

```ts
import { prisma } from "@/lib/db";

export async function listVenues() {
  return prisma.venue.findMany({
    select: {
      id: true, name: true, address: true, region: true,
      venueType: true, availabilityNote: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createVenueSuggestion(name: string, details?: string) {
  await prisma.venueSuggestion.create({ data: { name, details } });
}
```

`src/services/reportService.ts`:

```ts
import { prisma } from "@/lib/db";

export async function reportPost(
  targetType: "listing" | "session", targetId: string, ipHash: string,
): Promise<void> {
  const existing = await prisma.reportFlag.findFirst({
    where: { targetType, targetId, ipHash },
  });
  if (existing) return; // idempotent per ip
  await prisma.reportFlag.create({ data: { targetType, targetId, ipHash } });
}
```

- [ ] **Step 5: Implement routes**

`src/app/api/listings/route.ts`:

```ts
import { ok, fail, handleError } from "@/lib/api";
import { boardFilterSchema, createListingSchema } from "@/lib/schemas";
import { getClientIp, hashIp } from "@/lib/ip";
import { listListings, createListing } from "@/services/listingService";
import { assertCreateAllowed, recordCreate } from "@/services/rateLimitService";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = boardFilterSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return fail("Invalid filters", 400);
    return ok(await listListings(parsed.data));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = createListingSchema.safeParse(await req.json());
    if (!body.success) {
      // Honeypot trips look like success to the bot, write nothing.
      const issue = body.error.issues[0];
      if (issue?.path[0] === "website") return ok({ id: "ok", editToken: "ok" }, 201);
      return fail(issue?.message ?? "Invalid input", 400);
    }
    const ipHash = hashIp(getClientIp(req));
    await assertCreateAllowed(ipHash);
    const created = await createListing(body.data);
    await recordCreate(ipHash);
    return ok(created, 201);
  } catch (e) {
    return handleError(e);
  }
}
```

`src/app/api/listings/[id]/route.ts`:

```ts
import { ok, fail, handleError } from "@/lib/api";
import { getListing } from "@/services/listingService";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const listing = await getListing(id);
    return listing ? ok(listing) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
```

`src/app/api/listings/[id]/reveal/route.ts`:

```ts
import { ok, fail, handleError } from "@/lib/api";
import { getClientIp, hashIp } from "@/lib/ip";
import { revealListingPhone } from "@/services/listingService";
import { assertRevealAllowed } from "@/services/rateLimitService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await assertRevealAllowed(hashIp(getClientIp(req)), id);
    const phone = await revealListingPhone(id);
    return phone ? ok({ phone }) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
```

`src/app/api/listings/[id]/report/route.ts`:

```ts
import { ok, handleError } from "@/lib/api";
import { getClientIp, hashIp } from "@/lib/ip";
import { reportPost } from "@/services/reportService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await reportPost("listing", id, hashIp(getClientIp(req)));
    return ok({ reported: true });
  } catch (e) {
    return handleError(e);
  }
}
```

Session routes (`src/app/api/sessions/...`) are the same four files with `createSessionSchema`, `listSessions`, `createSession`, `getSession`, `revealSessionPhone`, and `reportPost("session", …)` substituted — write them out fully, same try/catch envelope shape.

`src/app/api/manage/[token]/route.ts`:

```ts
import { ok, fail, handleError } from "@/lib/api";
import { findPostByToken, closePostByToken, deletePostByToken } from "@/services/manageService";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const found = await findPostByToken(token);
    return found ? ok(found) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    return (await closePostByToken(token)) ? ok({ closed: true }) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    return (await deletePostByToken(token)) ? ok({ deleted: true }) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
```

`src/app/api/venues/route.ts`:

```ts
import { ok, handleError } from "@/lib/api";
import { listVenues } from "@/services/venueService";

export async function GET() {
  try {
    return ok(await listVenues());
  } catch (e) {
    return handleError(e);
  }
}
```

`src/app/api/venue-suggestions/route.ts`:

```ts
import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api";
import { createVenueSuggestion } from "@/services/venueService";

const schema = z.object({ name: z.string().min(3).max(120), details: z.string().max(300).optional() });

export async function POST(req: Request) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) return fail("Invalid input", 400);
    await createVenueSuggestion(body.data.name, body.data.details);
    return ok({ suggested: true }, 201);
  } catch (e) {
    return handleError(e);
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test` → all green (env, time, venues-data, schemas, ip, rateLimitService, listingService, sessionService, manageService, api, routes).

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.ts src/services/ src/app/api/
git commit -m "feat: full API surface with { data, error } envelope"
```

---

### Task 11: UI foundation — layout, shared components

> **UI tasks 11–15:** invoke the **frontend-design** skill before writing UI code, using the design direction from Global Constraints. The markup below is the functional contract (test ids, props, behavior); the skill refines visual treatment.

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Create: `src/components/StatusBadge.tsx`, `src/components/BottomSheet.tsx`, `src/components/ListingCard.tsx`, `src/components/SessionCard.tsx`
- Test: `src/components/__tests__/ListingCard.test.tsx`, `src/components/__tests__/BottomSheet.test.tsx`

**Interfaces:**
- Consumes: `PublicListing`, `PublicSession`, `formatPrice`.
- Produces:
  - `<StatusBadge status={"AVAILABLE"|"SOLD"|"OPEN"|"FILLED"|"EXPIRED"} />`
  - `<BottomSheet open onClose title>{children}</BottomSheet>` — fixed overlay + slide-up panel, closes on backdrop click
  - `<ListingCard listing={PublicListing} />` — whole card links to `/listing/[id]`
  - `<SessionCard session={PublicSession} />` — links to `/session/[id]`

- [ ] **Step 1: Write failing component tests**

`src/components/__tests__/ListingCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { ListingCard } from "@/components/ListingCard";

const listing = {
  id: "l1", date: new Date("2026-07-11T00:00:00Z"), startTime: "08:00", endTime: "10:00",
  priceCents: 1600, notes: null, status: "AVAILABLE" as const, createdAt: new Date(),
  venue: { id: "v1", name: "Choa Chu Kang Sport Hall", region: "WEST" as const,
    venueType: "SPORTS_HALL" as const, availabilityNote: null },
};

describe("ListingCard", () => {
  it("shows venue, time, region, price and links to detail", () => {
    render(<ListingCard listing={listing} />);
    expect(screen.getByText("Choa Chu Kang Sport Hall")).toBeInTheDocument();
    expect(screen.getByText(/08:00.*10:00/)).toBeInTheDocument();
    expect(screen.getByText("$16")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/listing/l1");
  });

  it("renders Free, SOLD badge, and school availability note", () => {
    render(<ListingCard listing={{
      ...listing, priceCents: 0, status: "SOLD" as const,
      venue: { ...listing.venue, venueType: "SCHOOL" as const, availabilityNote: "Weekends & school holidays only" },
    }} />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("SOLD")).toBeInTheDocument();
    expect(screen.getByText(/Weekends & school holidays/)).toBeInTheDocument();
  });
});
```

`src/components/__tests__/BottomSheet.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomSheet } from "@/components/BottomSheet";

describe("BottomSheet", () => {
  it("renders children when open, nothing when closed", () => {
    const { rerender } = render(<BottomSheet open onClose={() => {}} title="Region">hi</BottomSheet>);
    expect(screen.getByText("hi")).toBeInTheDocument();
    rerender(<BottomSheet open={false} onClose={() => {}} title="Region">hi</BottomSheet>);
    expect(screen.queryByText("hi")).not.toBeInTheDocument();
  });

  it("calls onClose on backdrop click", async () => {
    const onClose = jest.fn();
    render(<BottomSheet open onClose={onClose} title="Region">hi</BottomSheet>);
    await userEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ListingCard BottomSheet` → FAIL.

- [ ] **Step 3: Implement components**

`src/components/StatusBadge.tsx`:

```tsx
const STYLES: Record<string, string> = {
  AVAILABLE: "bg-court-light text-court",
  OPEN: "bg-court-light text-court",
  SOLD: "bg-gray-200 text-gray-500",
  FILLED: "bg-gray-200 text-gray-500",
  EXPIRED: "bg-gray-200 text-gray-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[status] ?? ""}`}>
      {status}
    </span>
  );
}
```

`src/components/BottomSheet.tsx`:

```tsx
"use client";

export function BottomSheet({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        data-testid="sheet-backdrop"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-8 shadow-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
        <h2 className="mb-3 text-sm font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

`src/components/ListingCard.tsx`:

```tsx
import Link from "next/link";
import type { PublicListing } from "@/services/listingService";
import { formatPrice } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";

export function ListingCard({ listing }: { listing: PublicListing }) {
  const dimmed = listing.status !== "AVAILABLE" ? "opacity-60" : "";
  return (
    <Link
      href={`/listing/${listing.id}`}
      className={`block rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${dimmed}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{listing.venue.name}</div>
          <div className="text-sm text-gray-500">
            {listing.startTime}–{listing.endTime} · {listing.venue.region}
          </div>
          {listing.venue.availabilityNote && (
            <div className="mt-1 text-xs text-amber-700">{listing.venue.availabilityNote}</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-bold text-court">{formatPrice(listing.priceCents)}</div>
          {listing.status !== "AVAILABLE" && <StatusBadge status={listing.status} />}
        </div>
      </div>
    </Link>
  );
}
```

`src/components/SessionCard.tsx` (same shape, session fields):

```tsx
import Link from "next/link";
import type { PublicSession } from "@/services/sessionService";
import { formatPrice } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";

const SKILL_LABEL = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" } as const;

export function SessionCard({ session }: { session: PublicSession }) {
  const dimmed = session.status !== "OPEN" ? "opacity-60" : "";
  return (
    <Link
      href={`/session/${session.id}`}
      className={`block rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${dimmed}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{session.venue.name}</div>
          <div className="text-sm text-gray-500">
            {session.startTime}–{session.endTime} · {session.venue.region}
          </div>
          <div className="mt-1 text-xs font-medium text-court">
            Needs {session.playersNeeded} · {SKILL_LABEL[session.skillLevel]}
          </div>
          {session.venue.availabilityNote && (
            <div className="mt-1 text-xs text-amber-700">{session.venue.availabilityNote}</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-bold text-court">{formatPrice(session.pricePerPlayerCents)}<span className="text-xs font-normal text-gray-400">/pax</span></div>
          {session.status !== "OPEN" && <StatusBadge status={session.status} />}
        </div>
      </div>
    </Link>
  );
}
```

`src/app/layout.tsx` — set metadata + shell:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BadmintonSG — court transfers & find players",
  description: "Grab a balloted badminton court someone can't use, or find players for your game.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-gray-900 antialiased">
        <div className="mx-auto max-w-md px-4 pb-24">{children}</div>
        <footer className="mx-auto max-w-md px-4 pb-6 text-center text-xs text-gray-400">
          We store only your post details and phone number, and delete numbers 7 days after a
          post expires. IPs are stored hashed, for rate limiting only.
        </footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ListingCard BottomSheet` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/app/layout.tsx src/app/globals.css
git commit -m "feat: UI foundation (cards, badge, bottom sheet, shell)"
```

---

### Task 12: Board page — tabs, date strip, filters

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/DateStrip.tsx`, `src/components/FilterBar.tsx`, `src/components/VenuePicker.tsx`
- Test: `src/components/__tests__/DateStrip.test.tsx`, `src/components/__tests__/VenuePicker.test.tsx`

**Interfaces:**
- Consumes: `listListings`, `listSessions`, `listVenues`, cards, `BottomSheet`, `formatDateLabel`, `todaySgt`, `boardFilterSchema`.
- Produces: `/` with URL-param state: `?tab=courts|players&date=YYYY-MM-DD&region=&venueId=&time=&skill=`. All filter components read/write `useSearchParams` + `router.replace` — filter state is shareable and survives refresh (spec §3.3).
  - `<DateStrip selected={string} />` — 14 day pills + 📅 native date input (min today, max +56d)
  - `<FilterBar venues={VenueOption[]} showSkill={boolean} />` where `VenueOption = { id, name, region, venueType, availabilityNote }`
  - `<VenuePicker venues onSelect={(id: string|null) => void} selectedId={string|null} />` — search input filters case-insensitively; grouped by region; used by FilterBar and (Task 14) forms

- [ ] **Step 1: Write failing tests**

`src/components/__tests__/DateStrip.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { DateStrip } from "@/components/DateStrip";
import { todaySgt } from "@/lib/time";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

describe("DateStrip", () => {
  it("renders Today first and 14 day pills", () => {
    render(<DateStrip selected={todaySgt()} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Tmrw")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(14);
    expect(screen.getByLabelText("Jump to date")).toBeInTheDocument();
  });
});
```

`src/components/__tests__/VenuePicker.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VenuePicker } from "@/components/VenuePicker";

const venues = [
  { id: "v1", name: "Our Tampines Hub", region: "EAST", venueType: "COMMUNITY_CENTRE", availabilityNote: null },
  { id: "v2", name: "Choa Chu Kang Sport Hall", region: "WEST", venueType: "SPORTS_HALL", availabilityNote: null },
  { id: "v3", name: "Dunman High (DUS)", region: "EAST", venueType: "SCHOOL", availabilityNote: "Weekends only" },
];

describe("VenuePicker", () => {
  it("filters by search text", async () => {
    render(<VenuePicker venues={venues} selectedId={null} onSelect={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/search/i), "tamp");
    expect(screen.getByText("Our Tampines Hub")).toBeInTheDocument();
    expect(screen.queryByText("Choa Chu Kang Sport Hall")).not.toBeInTheDocument();
  });

  it("calls onSelect with the venue id", async () => {
    const onSelect = jest.fn();
    render(<VenuePicker venues={venues} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("Choa Chu Kang Sport Hall"));
    expect(onSelect).toHaveBeenCalledWith("v2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- DateStrip VenuePicker` → FAIL.

- [ ] **Step 3: Implement `src/components/DateStrip.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dayjs from "dayjs";
import { todaySgt, maxPostDateSgt, formatDateLabel } from "@/lib/time";

export function DateStrip({ selected }: { selected: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const days = Array.from({ length: 14 }, (_, i) =>
    dayjs(todaySgt()).add(i, "day").format("YYYY-MM-DD"),
  );

  function go(date: string) {
    const next = new URLSearchParams(params);
    next.set("date", date);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2">
      {days.map((d) => (
        <button
          key={d}
          onClick={() => go(d)}
          className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
            d === selected ? "border-court bg-court text-white" : "border-gray-300 bg-white"
          }`}
        >
          {formatDateLabel(d)}
        </button>
      ))}
      <label className="relative shrink-0 rounded-full border border-court px-3 py-1 text-sm text-court">
        📅
        <input
          aria-label="Jump to date"
          type="date"
          min={todaySgt()}
          max={maxPostDateSgt()}
          className="absolute inset-0 opacity-0"
          onChange={(e) => e.target.value && go(e.target.value)}
        />
      </label>
    </div>
  );
}
```

(Native date input = the month picker: on mobile it opens the system calendar sheet — no custom calendar component needed.)

- [ ] **Step 4: Implement `src/components/VenuePicker.tsx`**

```tsx
"use client";

import { useState } from "react";

export type VenueOption = {
  id: string; name: string; region: string; venueType: string; availabilityNote: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  SPORTS_HALL: "Sports Hall", COMMUNITY_CENTRE: "CC", SCHOOL: "School", OTHER: "",
};

export function VenuePicker({
  venues, selectedId, onSelect,
}: {
  venues: VenueOption[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const matches = venues.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()));
  const regions = [...new Set(matches.map((v) => v.region))];

  return (
    <div>
      <input
        placeholder="Search venues…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="max-h-72 overflow-y-auto">
        {selectedId && (
          <button onClick={() => onSelect(null)} className="mb-2 text-sm text-court underline">
            Clear venue filter
          </button>
        )}
        {regions.map((region) => (
          <div key={region}>
            <div className="mt-2 text-xs font-bold uppercase tracking-wide text-gray-400">{region}</div>
            {matches.filter((v) => v.region === region).map((v) => (
              <button
                key={v.id}
                onClick={() => onSelect(v.id)}
                className={`block w-full rounded-lg px-2 py-2 text-left text-sm ${
                  v.id === selectedId ? "bg-court-light" : ""
                }`}
              >
                {v.name}
                <span className="ml-2 text-xs text-gray-400">{TYPE_LABEL[v.venueType]}</span>
                {v.availabilityNote && (
                  <span className="ml-1 text-xs text-amber-700">· {v.availabilityNote}</span>
                )}
              </button>
            ))}
          </div>
        ))}
        {matches.length === 0 && <p className="py-4 text-center text-sm text-gray-400">No venues match</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/components/FilterBar.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { VenuePicker, type VenueOption } from "@/components/VenuePicker";

const REGIONS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"] as const;
const TIMES = [["MORNING", "Morning"], ["AFTERNOON", "Afternoon"], ["EVENING", "Evening"]] as const;
const SKILLS = [["BEGINNER", "Beginner"], ["INTERMEDIATE", "Intermediate"], ["ADVANCED", "Advanced"]] as const;

type SheetKey = "region" | "venue" | "time" | "skill" | null;

export function FilterBar({ venues, showSkill }: { venues: VenueOption[]; showSkill: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [sheet, setSheet] = useState<SheetKey>(null);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
    setSheet(null);
  }

  const region = params.get("region");
  const venueId = params.get("venueId");
  const time = params.get("time");
  const skill = params.get("skill");
  const venueName = venues.find((v) => v.id === venueId)?.name;

  const chip = (label: string, active: string | null, key: SheetKey, paramKey: string) => (
    <button
      onClick={() => (active ? setParam(paramKey, null) : setSheet(key))}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
        active ? "border-court bg-court text-white" : "border-gray-300 bg-white text-gray-600"
      }`}
    >
      {active ? `${active} ✕` : `${label} ▾`}
    </button>
  );

  const pill = (selected: boolean) =>
    `mr-2 mb-2 rounded-full border px-3 py-1.5 text-sm ${
      selected ? "border-court bg-court-light font-semibold text-court" : "border-gray-300"
    }`;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {chip("Region", region, "region", "region")}
      {chip("Venue", venueName ?? null, "venue", "venueId")}
      {chip("Time", time, "time", "time")}
      {showSkill && chip("Skill", skill, "skill", "skill")}

      <BottomSheet open={sheet === "region"} onClose={() => setSheet(null)} title="Region">
        {REGIONS.map((r) => (
          <button key={r} className={pill(r === region)} onClick={() => setParam("region", r)}>{r}</button>
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === "venue"} onClose={() => setSheet(null)} title="Venue">
        <VenuePicker venues={venues} selectedId={venueId} onSelect={(id) => setParam("venueId", id)} />
      </BottomSheet>

      <BottomSheet open={sheet === "time"} onClose={() => setSheet(null)} title="Time of day">
        {TIMES.map(([v, label]) => (
          <button key={v} className={pill(v === time)} onClick={() => setParam("time", v)}>{label}</button>
        ))}
      </BottomSheet>

      {showSkill && (
        <BottomSheet open={sheet === "skill"} onClose={() => setSheet(null)} title="Skill level">
          {SKILLS.map(([v, label]) => (
            <button key={v} className={pill(v === skill)} onClick={() => setParam("skill", v)}>{label}</button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Implement `src/app/page.tsx` (server component)**

```tsx
import Link from "next/link";
import { boardFilterSchema } from "@/lib/schemas";
import { todaySgt } from "@/lib/time";
import { listListings } from "@/services/listingService";
import { listSessions } from "@/services/sessionService";
import { listVenues } from "@/services/venueService";
import { DateStrip } from "@/components/DateStrip";
import { FilterBar } from "@/components/FilterBar";
import { ListingCard } from "@/components/ListingCard";
import { SessionCard } from "@/components/SessionCard";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const tab = raw.tab === "players" ? "players" : "courts";
  const parsed = boardFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : {};
  const date = filters.date ?? todaySgt();

  const venues = await listVenues();
  const rows = tab === "courts"
    ? await listListings({ ...filters, date })
    : await listSessions({ ...filters, date });

  const tabClass = (active: boolean) =>
    `border-b-2 px-3 py-2 text-sm font-semibold ${
      active ? "border-court text-court" : "border-transparent text-gray-400"
    }`;

  return (
    <main>
      <header className="flex items-center justify-between pt-4">
        <h1 className="text-lg font-bold">🏸 BadmintonSG</h1>
      </header>

      <nav className="mt-2 flex border-b border-gray-200">
        <Link href={`/?tab=courts&date=${date}`} className={tabClass(tab === "courts")}>Courts</Link>
        <Link href={`/?tab=players&date=${date}`} className={tabClass(tab === "players")}>Players</Link>
      </nav>

      <DateStrip selected={date} />
      <FilterBar venues={venues} showSkill={tab === "players"} />

      <div className="mt-2 space-y-2">
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">
            Nothing on this day yet — try another date, or post the first one.
          </p>
        )}
        {tab === "courts"
          ? (rows as Awaited<ReturnType<typeof listListings>>).map((l) => <ListingCard key={l.id} listing={l} />)
          : (rows as Awaited<ReturnType<typeof listSessions>>).map((s) => <SessionCard key={s.id} session={s} />)}
      </div>

      <Link
        href="/post"
        aria-label="Post"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-court text-2xl text-white shadow-lg"
      >
        +
      </Link>
    </main>
  );
}
```

- [ ] **Step 7: Run tests + manual check**

Run: `npm test -- DateStrip VenuePicker` → PASS. Run `npm run dev`, open http://localhost:3000 on a 390px viewport: tabs switch, date pills navigate, chips open sheets, empty state shows. Create a listing via `curl` against `POST /api/listings` and confirm it renders.

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx src/components/
git commit -m "feat: board page with tabs, date strip, bottom-sheet filters"
```

---

### Task 13: Detail pages with click-to-reveal + report

**Files:**
- Create: `src/app/listing/[id]/page.tsx`, `src/app/session/[id]/page.tsx`, `src/components/RevealButton.tsx`, `src/components/ReportButton.tsx`
- Test: `src/components/__tests__/RevealButton.test.tsx`

**Interfaces:**
- Consumes: `getListing`, `getSession`, `formatPrice`, `formatDateLabel`, `dateToStr`, `StatusBadge`.
- Produces:
  - `<RevealButton endpoint={string} />` — POSTs to `/api/(listings|sessions)/[id]/reveal`; on success renders the number with `tel:` + `wa.me` links; on 429 shows the rate-limit message
  - `<ReportButton endpoint={string} />` — POSTs, then shows "Reported — thanks"

- [ ] **Step 1: Write failing test**

`src/components/__tests__/RevealButton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevealButton } from "@/components/RevealButton";

describe("RevealButton", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reveals the phone with tel and WhatsApp links", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { phone: "91234567" }, error: null }),
    }) as jest.Mock;

    render(<RevealButton endpoint="/api/listings/l1/reveal" />);
    await userEvent.click(screen.getByRole("button", { name: /reveal/i }));

    expect(await screen.findByText("9123 4567")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call/i })).toHaveAttribute("href", "tel:+6591234567");
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
      "href", "https://wa.me/6591234567",
    );
    expect(global.fetch).toHaveBeenCalledWith("/api/listings/l1/reveal", { method: "POST" });
  });

  it("shows rate-limit message on 429", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ data: null, error: "Too many requests — try again later" }),
    }) as jest.Mock;

    render(<RevealButton endpoint="/api/listings/l1/reveal" />);
    await userEvent.click(screen.getByRole("button", { name: /reveal/i }));
    expect(await screen.findByText(/too many requests/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- RevealButton` → FAIL.

- [ ] **Step 3: Implement `src/components/RevealButton.tsx`**

```tsx
"use client";

import { useState } from "react";

export function RevealButton({ endpoint }: { endpoint: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.data) setError(json.error ?? "Something went wrong");
      else setPhone(json.data.phone);
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (phone) {
    const pretty = `${phone.slice(0, 4)} ${phone.slice(4)}`;
    return (
      <div className="rounded-xl bg-court-light p-4 text-center">
        <div className="text-xl font-bold text-court">{pretty}</div>
        <div className="mt-3 flex justify-center gap-3">
          <a href={`tel:+65${phone}`} className="rounded-full bg-court px-4 py-2 text-sm font-semibold text-white">
            Call
          </a>
          <a href={`https://wa.me/65${phone}`} className="rounded-full border border-court px-4 py-2 text-sm font-semibold text-court">
            WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={reveal}
        disabled={loading}
        className="w-full rounded-xl bg-court py-3 font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Revealing…" : "Reveal contact"}
      </button>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/components/ReportButton.tsx`**

```tsx
"use client";

import { useState } from "react";

export function ReportButton({ endpoint }: { endpoint: string }) {
  const [done, setDone] = useState(false);

  if (done) return <p className="text-center text-xs text-gray-400">Reported — thanks</p>;
  return (
    <button
      onClick={async () => {
        await fetch(endpoint, { method: "POST" }).catch(() => {});
        setDone(true);
      }}
      className="mx-auto block text-xs text-gray-400 underline"
    >
      Report this post
    </button>
  );
}
```

- [ ] **Step 5: Implement detail pages**

`src/app/listing/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getListing } from "@/services/listingService";
import { formatPrice, formatDateLabel, dateToStr } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { RevealButton } from "@/components/RevealButton";
import { ReportButton } from "@/components/ReportButton";

export const dynamic = "force-dynamic";

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  return (
    <main className="pt-6">
      <a href="/" className="text-sm text-gray-400">← Back to courts</a>
      <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <h1 className="text-lg font-bold">{listing.venue.name}</h1>
          <StatusBadge status={listing.status} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {formatDateLabel(dateToStr(listing.date))} · {listing.startTime}–{listing.endTime}
        </p>
        <p className="text-sm text-gray-500">{listing.venue.region} · {listing.venue.name}</p>
        {listing.venue.availabilityNote && (
          <p className="mt-1 text-xs text-amber-700">{listing.venue.availabilityNote}</p>
        )}
        <p className="mt-3 text-2xl font-bold text-court">{formatPrice(listing.priceCents)}</p>
        {listing.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{listing.notes}</p>}
        <div className="mt-4">
          {listing.status === "AVAILABLE"
            ? <RevealButton endpoint={`/api/listings/${listing.id}/reveal`} />
            : <p className="text-center text-sm text-gray-400">This court has been taken.</p>}
        </div>
      </div>
      <div className="mt-4">
        <ReportButton endpoint={`/api/listings/${listing.id}/report`} />
      </div>
    </main>
  );
}
```

`src/app/session/[id]/page.tsx` — same structure with `getSession`, "← Back to players" (`/?tab=players`), the extra lines:

```tsx
<p className="mt-2 text-sm font-medium text-court">
  Needs {session.playersNeeded} player{session.playersNeeded > 1 ? "s" : ""} · {session.skillLevel}
</p>
<p className="mt-3 text-2xl font-bold text-court">
  {formatPrice(session.pricePerPlayerCents)}<span className="text-sm font-normal text-gray-400">/pax</span>
</p>
```

reveal/report endpoints under `/api/sessions/...`, "Open" gate: `session.status === "OPEN" ? <RevealButton …/> : <p …>This game is filled.</p>`.

- [ ] **Step 6: Run tests + manual check**

Run: `npm test -- RevealButton` → PASS. Dev server: open a seeded listing's detail, click Reveal → number appears; click 4× on the same listing from fresh states → 429 message.

- [ ] **Step 7: Commit**

```bash
git add src/app/listing/ src/app/session/ src/components/
git commit -m "feat: detail pages with rate-limited click-to-reveal + report"
```

---

### Task 14: Post flow — chooser, forms, success-on-manage redirect

**Files:**
- Create: `src/app/post/page.tsx`, `src/app/post/court/page.tsx`, `src/app/post/game/page.tsx`, `src/components/PostForm.tsx`
- Test: covered by Playwright in Task 16 (forms are thin wiring over already-tested schemas/APIs); no new Jest tests

**Interfaces:**
- Consumes: `listVenues`, `VenuePicker`, `BottomSheet`, `TIME_OPTIONS`, `todaySgt`, `maxPostDateSgt`.
- Produces: `<PostForm kind={"court"|"game"} venues={VenueOption[]} />` — client form; on success `router.push('/manage/'+editToken+'?created=1')`. The manage page doubles as the success page (DRY — the "save your link" moment and the manage view are the same screen).

- [ ] **Step 1: Chooser `src/app/post/page.tsx`**

```tsx
import Link from "next/link";

export default function PostChooser() {
  return (
    <main className="pt-10">
      <a href="/" className="text-sm text-gray-400">← Back</a>
      <h1 className="mt-4 text-xl font-bold">What are you posting?</h1>
      <div className="mt-6 space-y-3">
        <Link href="/post/court" className="block rounded-2xl border-2 border-court bg-white p-4">
          <div className="font-bold text-court">Sell a court slot</div>
          <div className="text-sm text-gray-500">Balloted a court you can't use? Pass it on.</div>
        </Link>
        <Link href="/post/game" className="block rounded-2xl border-2 border-gray-300 bg-white p-4">
          <div className="font-bold">Host a game — find players</div>
          <div className="text-sm text-gray-500">Have a court but not enough players.</div>
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Implement `src/components/PostForm.tsx`**

One form component, `kind` toggles the game-only fields and target endpoint. Full code:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { VenuePicker, type VenueOption } from "@/components/VenuePicker";
import { todaySgt, maxPostDateSgt, TIME_OPTIONS } from "@/lib/time";

export function PostForm({ kind, venues }: { kind: "court" | "game"; venues: VenueOption[] }) {
  const router = useRouter();
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueSheet, setVenueSheet] = useState(false);
  const [date, setDate] = useState(todaySgt());
  const [startTime, setStartTime] = useState("08:00");
  const [duration, setDuration] = useState(2);
  const [price, setPrice] = useState("");        // dollars string; "" → negotiable
  const [free, setFree] = useState(false);
  const [playersNeeded, setPlayersNeeded] = useState(2);
  const [skillLevel, setSkillLevel] = useState("INTERMEDIATE");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const venueName = venues.find((v) => v.id === venueId)?.name;
  const endTime = `${String(Math.min(23, parseInt(startTime) + duration)).padStart(2, "0")}:00`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!venueId) return setError("Pick a venue");
    setSubmitting(true);

    const cents = free ? 0 : price === "" ? null : Math.round(parseFloat(price) * 100);
    const body =
      kind === "court"
        ? { venueId, date, startTime, endTime, priceCents: cents, notes: notes || undefined, phone, website: "" }
        : { venueId, date, startTime, endTime, playersNeeded, skillLevel,
            pricePerPlayerCents: cents, notes: notes || undefined, phone, website: "" };

    const res = await fetch(kind === "court" ? "/api/listings" : "/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok || !json.data) return setError(json.error ?? "Something went wrong");
    router.push(`/manage/${json.data.editToken}?created=1`);
  }

  const label = "block text-sm font-semibold mt-4 mb-1";
  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white";

  return (
    <form onSubmit={submit}>
      <label className={label}>Venue</label>
      <button type="button" onClick={() => setVenueSheet(true)} className={`${input} text-left`}>
        {venueName ?? "Choose a venue…"}
      </button>
      <BottomSheet open={venueSheet} onClose={() => setVenueSheet(false)} title="Venue">
        <VenuePicker venues={venues} selectedId={venueId}
          onSelect={(id) => { setVenueId(id); setVenueSheet(false); }} />
      </BottomSheet>
      <p className="mt-1 text-xs text-gray-400">
        Venue not listed?{" "}
        <a className="underline" href="/venue-request">Request it</a>
      </p>

      <label className={label}>Date</label>
      <input className={input} type="date" value={date} min={todaySgt()} max={maxPostDateSgt()}
        onChange={(e) => setDate(e.target.value)} required />

      <div className="flex gap-3">
        <div className="flex-1">
          <label className={label}>Start</label>
          <select className={input} value={startTime} onChange={(e) => setStartTime(e.target.value)}>
            {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className={label}>Hours</label>
          <select className={input} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[1, 2, 3, 4].map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      {kind === "game" && (
        <>
          <label className={label}>Players needed</label>
          <select className={input} value={playersNeeded} onChange={(e) => setPlayersNeeded(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className={label}>Skill level</label>
          <select className={input} aria-label="Skill level" value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)}>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </>
      )}

      <label className={label}>{kind === "court" ? "Price (SGD)" : "Cost per player (SGD)"}</label>
      <div className="flex items-center gap-3">
        <input className={input} type="number" step="0.50" min="0" placeholder="Leave blank for negotiable"
          value={price} disabled={free} onChange={(e) => setPrice(e.target.value)} />
        <label className="flex shrink-0 items-center gap-1 text-sm">
          <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Free
        </label>
      </div>

      <label className={label}>Notes (optional)</label>
      <textarea className={input} maxLength={300} rows={2} value={notes}
        placeholder={kind === "court" ? "e.g. court 3, transfer at counter" : "e.g. doubles, bring own shuttles"}
        onChange={(e) => setNotes(e.target.value)} />

      <label className={label}>Your mobile number</label>
      <input className={input} type="tel" inputMode="numeric" placeholder="9123 4567" value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\s/g, ""))} required />
      <p className="mt-1 text-xs text-gray-400">
        Shown only to people who tap "Reveal contact". Deleted 7 days after your post expires.
      </p>

      {/* honeypot — hidden from real users */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting}
        className="mt-5 w-full rounded-xl bg-court py-3 font-semibold text-white disabled:opacity-50">
        {submitting ? "Posting…" : kind === "court" ? "Post court" : "Post game"}
      </button>
    </form>
  );
}
```

The venue-request link points at `/venue-request`; add `src/app/venue-request/page.tsx`: a 20-line client page with name + details inputs POSTing to `/api/venue-suggestions` and a "Thanks — we'll add it soon" done state.

- [ ] **Step 3: Wrap pages**

`src/app/post/court/page.tsx`:

```tsx
import { listVenues } from "@/services/venueService";
import { PostForm } from "@/components/PostForm";

export const dynamic = "force-dynamic";

export default async function PostCourt() {
  const venues = await listVenues();
  return (
    <main className="pt-6">
      <a href="/post" className="text-sm text-gray-400">← Back</a>
      <h1 className="mt-2 text-xl font-bold">Sell a court slot</h1>
      <PostForm kind="court" venues={venues} />
    </main>
  );
}
```

`src/app/post/game/page.tsx` — identical with `kind="game"`, title "Host a game".

- [ ] **Step 4: Manual verify**

Dev server: post a court end-to-end → lands on `/manage/<token>?created=1` (404 until Task 15 — confirm the URL is correct and the DB row exists via `npx prisma studio`). Post with a bad phone → inline error from the API envelope.

- [ ] **Step 5: Commit**

```bash
git add src/app/post/ src/app/venue-request/ src/components/PostForm.tsx
git commit -m "feat: post flow (chooser, court + game forms, venue request)"
```

---

### Task 15: Manage page (doubles as success page)

**Files:**
- Create: `src/app/manage/[token]/page.tsx`, `src/components/ManageActions.tsx`, `src/components/CopyLinkButton.tsx`

**Interfaces:**
- Consumes: `findPostByToken`, `formatDateLabel`, `StatusBadge`.
- Produces: `/manage/[token]` — `?created=1` shows the "save this link" banner + copy button; actions call `PATCH`/`DELETE /api/manage/[token]` then `router.refresh()` / redirect home. Page metadata sets `robots: noindex`.

- [ ] **Step 1: Implement `src/components/CopyLinkButton.tsx`**

```tsx
"use client";

import { useState } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.href.split("?")[0]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="mt-2 w-full rounded-lg border border-court py-2 text-sm font-semibold text-court"
    >
      {copied ? "Copied ✓" : "Copy manage link"}
    </button>
  );
}
```

- [ ] **Step 2: Implement `src/components/ManageActions.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManageActions({
  token, type, closed,
}: {
  token: string; type: "listing" | "session"; closed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const closeLabel = type === "listing" ? "Mark as sold" : "Mark as filled";

  async function act(method: "PATCH" | "DELETE") {
    if (method === "DELETE" && !confirm("Delete this post permanently?")) return;
    setBusy(true);
    const res = await fetch(`/api/manage/${token}`, { method });
    setBusy(false);
    if (!res.ok) return alert("Something went wrong — try again");
    if (method === "DELETE") router.push("/");
    else router.refresh();
  }

  return (
    <div className="mt-4 space-y-2">
      {!closed && (
        <button onClick={() => act("PATCH")} disabled={busy}
          className="w-full rounded-xl bg-court py-3 font-semibold text-white disabled:opacity-50">
          {closeLabel}
        </button>
      )}
      <button onClick={() => act("DELETE")} disabled={busy}
        className="w-full rounded-xl border border-red-300 py-3 font-semibold text-red-600 disabled:opacity-50">
        Delete post
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/app/manage/[token]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPostByToken } from "@/services/manageService";
import { formatDateLabel } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { ManageActions } from "@/components/ManageActions";
import { CopyLinkButton } from "@/components/CopyLinkButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ManagePage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { token } = await params;
  const { created } = await searchParams;
  const found = await findPostByToken(token);
  if (!found) notFound();

  const { type, post } = found;
  const closed = post.status === "SOLD" || post.status === "FILLED";

  return (
    <main className="pt-6">
      {created && (
        <div className="rounded-2xl bg-court-light p-4">
          <h1 className="font-bold text-court">🎉 Posted!</h1>
          <p className="mt-1 text-sm text-court">
            <strong>Save this page's link.</strong> It's the only way to mark your post
            {type === "listing" ? " sold" : " filled"} or delete it — there's no login.
          </p>
          <CopyLinkButton />
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <h2 className="font-bold">{post.venueName}</h2>
          <StatusBadge status={post.status} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {formatDateLabel(post.date)} · {post.startTime}–{post.endTime}
        </p>
        <ManageActions token={token} type={type} closed={closed} />
      </div>

      <a href="/" className="mt-4 block text-center text-sm text-gray-400">← Back to the board</a>
    </main>
  );
}
```

- [ ] **Step 4: Manual verify**

Post a court → banner shows, copy button works, "Mark as sold" flips the badge to SOLD (page refreshes), board shows the SOLD badge, Delete removes it and redirects home. `curl -s http://localhost:3000/manage/<token> | grep -i robots` shows the noindex meta.

- [ ] **Step 5: Commit**

```bash
git add src/app/manage/ src/components/ManageActions.tsx src/components/CopyLinkButton.tsx
git commit -m "feat: manage page with success banner, close + delete actions"
```

---

### Task 16: Playwright E2E — the core loop

**Files:**
- Create: `playwright.config.ts`, `e2e/core-loop.spec.ts`

**Interfaces:**
- Consumes: the running app (`npm run dev` via Playwright webServer) + seeded venues + dev DB.

- [ ] **Step 1: `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Write `e2e/core-loop.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

const PHONE = "91234567";

test("court: post → browse → detail → reveal → mark sold", async ({ page }) => {
  // Post
  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post court/i }).click();

  // Success = manage page with banner
  await expect(page).toHaveURL(/\/manage\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByText(/save this page's link/i)).toBeVisible();
  const manageUrl = page.url().split("?")[0];

  // Browse: today's board shows it
  await page.goto("/");
  const card = page.getByRole("link", { name: /choa chu kang/i }).first();
  await expect(card).toBeVisible();
  await expect(page.getByText("$16").first()).toBeVisible();
  // Phone must not be anywhere in the page HTML
  expect(await page.content()).not.toContain(PHONE);

  // Detail + reveal
  await card.click();
  await expect(page.getByRole("button", { name: /reveal contact/i })).toBeVisible();
  expect(await page.content()).not.toContain(PHONE);
  await page.getByRole("button", { name: /reveal contact/i }).click();
  await expect(page.getByText("9123 4567")).toBeVisible();
  await expect(page.getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
    "href", `https://wa.me/65${PHONE}`,
  );

  // Manage: mark sold
  await page.goto(manageUrl);
  await page.getByRole("button", { name: /mark as sold/i }).click();
  await expect(page.getByText("SOLD")).toBeVisible();

  // Board shows SOLD badge
  await page.goto("/");
  await expect(page.getByText("SOLD").first()).toBeVisible();
});

test("game: post → players tab → skill filter → detail", async ({ page }) => {
  await page.goto("/post/game");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await page.getByLabel("Skill level").selectOption("ADVANCED");
  await page.getByPlaceholder("9123 4567").fill("81234567");
  await page.getByRole("button", { name: /post game/i }).click();
  await expect(page).toHaveURL(/\/manage\//);
  const manageUrl = page.url().split("?")[0];

  await page.goto("/?tab=players");
  await expect(page.getByText(/needs 2/i).first()).toBeVisible();

  // Skill filter
  await page.getByRole("button", { name: /skill/i }).click();
  await page.getByRole("button", { name: /^Advanced$/ }).click();
  await expect(page.getByText(/needs 2/i).first()).toBeVisible();

  // Clean up so repeated runs don't hit the per-phone active-post cap
  page.on("dialog", (d) => d.accept());
  await page.goto(manageUrl);
  await page.getByRole("button", { name: /delete post/i }).click();
  await expect(page).toHaveURL("/");
});
```

- [ ] **Step 3: Run E2E**

Run: `npm run test:e2e`
Expected: both tests PASS against the dev server. If selectors drift from the built UI, fix the UI to expose accessible names (labels/roles), not the test to use CSS classes.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test: playwright core-loop E2E (court + game happy paths)"
```

---

### Task 17: Hardening — pino logging, headers, analytics

**Files:**
- Create: `src/lib/logger.ts`
- Modify: `src/lib/api.ts` (use logger), `next.config.ts` (headers), `src/app/layout.tsx` (Analytics), `package.json`

- [ ] **Step 1: `src/lib/logger.ts` with redaction**

```ts
import pino from "pino";

export const logger = pino({
  redact: {
    paths: ["phone", "*.phone", "editToken", "*.editToken", "req.url"],
    censor: "[redacted]",
  },
});
```

In `src/lib/api.ts`, replace `console.error(e)` with:

```ts
import { logger } from "@/lib/logger";
// …
logger.error({ err: e instanceof Error ? e.message : String(e) }, "unhandled route error");
```

- [ ] **Step 2: `X-Robots-Tag` for manage routes in `next.config.ts`**

```ts
const nextConfig = {
  async headers() {
    return [
      {
        source: "/manage/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Vercel Analytics**

```bash
npm install @vercel/analytics
```

In `src/app/layout.tsx` add `import { Analytics } from "@vercel/analytics/react";` and `<Analytics />` before `</body>`.

- [ ] **Step 4: Verify**

`npm test` all green, `npm run test:e2e` green, `curl -sI http://localhost:3000/manage/x | grep -i x-robots` → header present.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logger.ts src/lib/api.ts next.config.ts src/app/layout.tsx package.json package-lock.json
git commit -m "feat: pino logging with redaction, noindex headers, analytics"
```

---

### Task 18: Deploy — Supabase + Vercel + README

**Files:**
- Create: `README.md`
- Modify: `.env.example` (document prod values)

- [ ] **Step 1: Supabase project**

Create a project at supabase.com (region: Singapore `ap-southeast-1`). From Settings → Database copy:
- **Pooled** connection string (port 6543) → prod `DATABASE_URL`, appending `?pgbouncer=true&connection_limit=1`
- **Direct** connection string (port 5432) → prod `DIRECT_URL`

Run against prod: `npx prisma migrate deploy` then `npx prisma db seed` (with prod env vars set locally for this one-time run).

- [ ] **Step 2: Vercel project**

`npx vercel` link the repo (or import via dashboard). Set env vars: `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `IP_HASH_SALT` (fresh random: `openssl rand -hex 32`). Deploy: `npx vercel --prod`.

- [ ] **Step 3: Production smoke test (verify skill applies here)**

On the production URL, on a phone or 390px viewport: post a real court listing → reveal it from another browser → mark sold → delete. Check `/api/listings` response contains no `phone` key anywhere.

- [ ] **Step 4: Write `README.md`**

Cover: what the app is (2 sentences), local setup (`docker compose up -d`, `npx prisma migrate dev`, `npx prisma db seed`, `npm run dev`), test commands, deploy steps (Supabase pooled-vs-direct URL distinction, env vars), and a pointer to the spec + plan under `docs/superpowers/`.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example
git commit -m "docs: README with setup + deploy runbook"
```

---

## Final Verification (after all tasks)

1. `npm test` — full Jest suite green.
2. `npm run test:e2e` — both E2E specs green.
3. **verify skill**: drive the real app through the full loop (both boards) in a mobile viewport.
4. `/code-review` on the whole branch; fix findings.
5. `/init` to generate CLAUDE.md documenting what was actually built.

## Task Dependency Notes

- Tasks 2–6 depend only on Task 1. Tasks 7–9 need 2–6. Task 10 needs 7–9.
- Tasks 11–15 (UI) need 10; they are sequential (each builds on the previous components).
- Task 16 (E2E) needs 15. Tasks 17–18 close out.
- Frontend-design skill: invoke once at the start of Task 11 and keep its direction through Task 15.

