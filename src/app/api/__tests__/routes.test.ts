/** @jest-environment node */
import dayjs from "dayjs";
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt } from "@/lib/time";
import { POST as presenceRoute } from "@/app/api/presence/route";

// Bodies post TOMORROW so the same-day start-time-passed rule (schemas A2) never rejects them.
const tomorrow = dayjs(todaySgt()).add(1, "day").format("YYYY-MM-DD");
import { POST as createListingRoute, GET as listListingsRoute } from "@/app/api/listings/route";
import { POST as revealRoute } from "@/app/api/listings/[id]/reveal/route";
import { POST as reportRoute } from "@/app/api/listings/[id]/report/route";
import { GET as manageGet } from "@/app/api/manage/[token]/route";
import { PATCH as managePatch, DELETE as manageDelete } from "@/app/api/manage/[token]/[id]/route";
import { POST as createSessionRoute, GET as listSessionsRoute } from "@/app/api/sessions/route";
import { POST as sessionRevealRoute } from "@/app/api/sessions/[id]/reveal/route";
import { GET as venuesRoute } from "@/app/api/venues/route";
import { POST as suggestRoute } from "@/app/api/venue-suggestions/route";

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
      items: [{ venueId: venue.id, date: tomorrow, startTime: "08:00", endTime: "10:00", priceCents: 1600 }],
      phone: "+6591234567", website: "",
    };

    const createRes = await createListingRoute(req("http://x/api/listings", "POST", body));
    expect(createRes.status).toBe(201);
    const { data } = await createRes.json();
    expect(data.batchToken).toBeTruthy();
    const id = data.ids[0];

    const listRes = await listListingsRoute(new Request(`http://x/api/listings?date=${tomorrow}`));
    const list = await listRes.json();
    expect(list.data).toHaveLength(1);
    expect(JSON.stringify(list.data)).not.toContain("+6591234567");

    const revealRes = await revealRoute(req(`http://x/api/listings/${id}/reveal`, "POST"), params({ id }));
    expect((await revealRes.json()).data.phone).toBe("+6591234567");

    const mg = await manageGet(req(`http://x/api/manage/${data.batchToken}`, "GET"), params({ token: data.batchToken }));
    const mgJson = await mg.json();
    expect(mgJson.data).toHaveLength(1);
    expect(mgJson.data[0].type).toBe("listing");

    const mp = await managePatch(
      req(`http://x/api/manage/${data.batchToken}/${id}`, "PATCH", { type: "listing", action: "close" }),
      params({ token: data.batchToken, id }),
    );
    expect(mp.status).toBe(200);
    expect((await prisma.listing.findFirstOrThrow()).status).toBe("SOLD");

    // Once SOLD, a direct reveal hit (bypassing the UI, which hides the button) 404s.
    const revealAfterSold = await revealRoute(req(`http://x/api/listings/${id}/reveal`, "POST"), params({ id }));
    expect(revealAfterSold.status).toBe(404);

    const md = await manageDelete(
      req(`http://x/api/manage/${data.batchToken}/${id}`, "DELETE", { type: "listing" }),
      params({ token: data.batchToken, id }),
    );
    expect(md.status).toBe(200);
    expect(await prisma.listing.count()).toBe(0);
  });

  // Regression test: Object.fromEntries(url.searchParams) silently keeps only the LAST
  // value for a repeated key, so ?date=A&date=B was collapsing to just "B" and quietly
  // narrowing results instead of matching either date — a real bug in this public route,
  // even though the board page itself never hit it (it calls listListings directly).
  it("GET board matches ANY of several repeated ?date= params", async () => {
    const venue = await makeVenue();
    const dayAfter = dayjs(todaySgt()).add(2, "day").format("YYYY-MM-DD");
    const dayAfterThat = dayjs(todaySgt()).add(3, "day").format("YYYY-MM-DD");
    for (const date of [tomorrow, dayAfter, dayAfterThat]) {
      await createListingRoute(req("http://x/api/listings", "POST", {
        items: [{ venueId: venue.id, date, startTime: "08:00", endTime: "10:00", priceCents: 1600 }],
        phone: "+6591234567", website: "",
      }));
    }

    const res = await listListingsRoute(new Request(`http://x/api/listings?date=${tomorrow}&date=${dayAfter}`));
    const { data } = await res.json();
    expect(data).toHaveLength(2);
    expect(data.map((l: { date: string }) => l.date.slice(0, 10)).sort()).toEqual([tomorrow, dayAfter].sort());
  });

  it("posts a batch of courts under one manage link", async () => {
    const venue = await makeVenue();
    const body = {
      items: [
        { venueId: venue.id, date: tomorrow, startTime: "08:00", endTime: "10:00", priceCents: 1600 },
        { venueId: venue.id, date: tomorrow, startTime: "18:00", endTime: "20:00", priceCents: 2000 },
      ],
      phone: "+6591234567", website: "",
    };
    const createRes = await createListingRoute(req("http://x/api/listings", "POST", body));
    expect(createRes.status).toBe(201);
    const { data } = await createRes.json();
    expect(data.ids).toHaveLength(2);

    const mg = await manageGet(req(`http://x/api/manage/${data.batchToken}`, "GET"), params({ token: data.batchToken }));
    expect((await mg.json()).data).toHaveLength(2);
  });

  it("PATCH updatePlayers updates a session; PATCH close still works", async () => {
    const venue = await makeVenue();
    const createRes = await createSessionRoute(req("http://x/api/sessions", "POST", {
      items: [{
        venueId: venue.id, date: tomorrow, startTime: "18:00", endTime: "20:00",
        playersNeeded: 2, maxPax: 6, skillMin: "MID_INTERMEDIATE", skillMax: "MID_INTERMEDIATE", pricePerPlayerCents: null,
      }],
      phone: "+6591234567", website: "",
    }));
    const { data } = await createRes.json();
    const id = data.ids[0];

    const upd = await managePatch(
      req(`http://x/api/manage/${data.batchToken}/${id}`, "PATCH", { type: "session", action: "updatePlayers", playersNeeded: 4 }),
      params({ token: data.batchToken, id }),
    );
    expect(upd.status).toBe(200);
    expect((await prisma.gameSession.findFirstOrThrow()).playersNeeded).toBe(4);
    expect((await prisma.gameSession.findFirstOrThrow()).status).toBe("OPEN");

    const close = await managePatch(
      req(`http://x/api/manage/${data.batchToken}/${id}`, "PATCH", { type: "session", action: "close" }),
      params({ token: data.batchToken, id }),
    );
    expect(close.status).toBe(200);
    expect((await prisma.gameSession.findFirstOrThrow()).status).toBe("FILLED");
  });

  it("PATCH updatePlayers on a listing → 400", async () => {
    const venue = await makeVenue();
    const createRes = await createListingRoute(req("http://x/api/listings", "POST", {
      items: [{ venueId: venue.id, date: tomorrow, startTime: "08:00", endTime: "10:00", priceCents: 0 }],
      phone: "+6591234567", website: "",
    }));
    const { data } = await createRes.json();
    const id = data.ids[0];

    const res = await managePatch(
      req(`http://x/api/manage/${data.batchToken}/${id}`, "PATCH", { type: "listing", action: "updatePlayers", playersNeeded: 4 }),
      params({ token: data.batchToken, id }),
    );
    expect(res.status).toBe(400);
    expect((await prisma.listing.findFirstOrThrow()).status).toBe("AVAILABLE");
  });

  it("PATCH edit updates a listing's time/price/notes", async () => {
    const venue = await makeVenue();
    const createRes = await createListingRoute(req("http://x/api/listings", "POST", {
      items: [{ venueId: venue.id, date: tomorrow, startTime: "08:00", endTime: "10:00", priceCents: 0 }],
      phone: "+6591234567", website: "",
    }));
    const { data } = await createRes.json();
    const id = data.ids[0];

    const res = await managePatch(
      req(`http://x/api/manage/${data.batchToken}/${id}`, "PATCH", {
        type: "listing", action: "edit",
        date: tomorrow, startTime: "09:00", endTime: "11:00", priceCents: 2500, notes: "edited",
        phone: "+6591234567",
      }),
      params({ token: data.batchToken, id }),
    );
    expect(res.status).toBe(200);
    const row = await prisma.listing.findFirstOrThrow();
    expect(row.startTime).toBe("09:00");
    expect(row.priceCents).toBe(2500);
    expect(row.notes).toBe("edited");
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
      items: [{ venueId: venue.id, date: tomorrow, startTime: "08:00", endTime: "10:00", priceCents: 0 }],
      phone: "+6591234567", website: "http://spam.example",
    }));
    expect(res.status).toBe(201);
    expect(await prisma.listing.count()).toBe(0);
  });

  it("manage GET returns an empty list for an unknown token", async () => {
    const t = "00000000-0000-0000-0000-000000000000";
    const res = await manageGet(req(`http://x/api/manage/${t}`, "GET"), params({ token: t }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  it("manage PATCH/DELETE 404 for a row not owned by this token", async () => {
    const venue = await makeVenue();
    const createRes = await createListingRoute(req("http://x/api/listings", "POST", {
      items: [{ venueId: venue.id, date: tomorrow, startTime: "08:00", endTime: "10:00", priceCents: 0 }],
      phone: "+6591234567", website: "",
    }));
    const { data } = await createRes.json();
    const id = data.ids[0];
    const wrongToken = "00000000-0000-0000-0000-000000000000";

    const patchRes = await managePatch(
      req(`http://x/api/manage/${wrongToken}/${id}`, "PATCH", { type: "listing", action: "close" }),
      params({ token: wrongToken, id }),
    );
    expect(patchRes.status).toBe(404);

    const delRes = await manageDelete(
      req(`http://x/api/manage/${wrongToken}/${id}`, "DELETE", { type: "listing" }),
      params({ token: wrongToken, id }),
    );
    expect(delRes.status).toBe(404);
  });

  it("report is idempotent per ip, but a different ip adds a second flag", async () => {
    const venue = await makeVenue();
    const createRes = await createListingRoute(req("http://x/api/listings", "POST", {
      items: [{ venueId: venue.id, date: tomorrow, startTime: "08:00", endTime: "10:00", priceCents: 1600 }],
      phone: "+6591234567", website: "",
    }));
    const { data } = await createRes.json();
    const id = data.ids[0];

    const r1 = await reportRoute(req(`http://x/api/listings/${id}/report`, "POST", undefined, "5.5.5.5"), params({ id }));
    expect(r1.status).toBe(200);
    expect((await r1.json()).data.reported).toBe(true);

    const r2 = await reportRoute(req(`http://x/api/listings/${id}/report`, "POST", undefined, "5.5.5.5"), params({ id }));
    expect(r2.status).toBe(200);
    expect(await prisma.reportFlag.count()).toBe(1);

    const r3 = await reportRoute(req(`http://x/api/listings/${id}/report`, "POST", undefined, "6.6.6.6"), params({ id }));
    expect(r3.status).toBe(200);
    expect(await prisma.reportFlag.count()).toBe(2);
  });
});

describe("sessions API", () => {
  it("POST create → GET board (no phone) → reveal", async () => {
    const venue = await makeVenue();
    const body = {
      items: [{
        venueId: venue.id, date: tomorrow, startTime: "18:00", endTime: "20:00",
        playersNeeded: 2, maxPax: 6, skillMin: "MID_INTERMEDIATE", skillMax: "MID_INTERMEDIATE", pricePerPlayerCents: 400,
      }],
      phone: "+6591234567", website: "",
    };

    const createRes = await createSessionRoute(req("http://x/api/sessions", "POST", body));
    expect(createRes.status).toBe(201);
    const { data } = await createRes.json();
    expect(data.batchToken).toBeTruthy();
    const id = data.ids[0];

    const listRes = await listSessionsRoute(new Request(`http://x/api/sessions?date=${tomorrow}`));
    const listJson = await listRes.json();
    expect(JSON.stringify(listJson)).not.toContain("+6591234567");

    const revealRes = await sessionRevealRoute(req(`http://x/api/sessions/${id}/reveal`, "POST"), params({ id }));
    expect((await revealRes.json()).data.phone).toBe("+6591234567");
  });
});

describe("venues API", () => {
  it("GET venues includes newly created venue", async () => {
    const venue = await makeVenue("Suggested Court Hall");
    const res = await venuesRoute();
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data.some((v: { id: string }) => v.id === venue.id)).toBe(true);
  });

  it("POST venue-suggestions creates a suggestion", async () => {
    const res = await suggestRoute(req("http://x/api/venue-suggestions", "POST", {
      name: "New Hall Somewhere", details: "near my house",
    }));
    expect(res.status).toBe(201);
    expect(await prisma.venueSuggestion.count()).toBe(1);
  });
});

describe("presence API", () => {
  it("POST /api/presence with a uuid → 200 + numeric count; invalid body → 400", async () => {
    const res = await presenceRoute(req("http://x/api/presence", "POST", {
      id: "3f0e37f5-2f3a-4a4a-9d4a-111111111111",
    }));
    expect(res.status).toBe(200);
    expect(typeof (await res.json()).data.count).toBe("number");

    const bad = await presenceRoute(req("http://x/api/presence", "POST", { id: "not-a-uuid" }));
    expect(bad.status).toBe(400);
  });
});
