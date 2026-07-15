/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt } from "@/lib/time";
import { POST as createListingRoute, GET as listListingsRoute } from "@/app/api/listings/route";
import { POST as revealRoute } from "@/app/api/listings/[id]/reveal/route";
import { POST as reportRoute } from "@/app/api/listings/[id]/report/route";
import { GET as manageGet, PATCH as managePatch, DELETE as manageDelete } from "@/app/api/manage/[token]/route";
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
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 1600, phone: "+6591234567", website: "",
    };

    const createRes = await createListingRoute(req("http://x/api/listings", "POST", body));
    expect(createRes.status).toBe(201);
    const { data } = await createRes.json();
    expect(data.editToken).toBeTruthy();

    const listRes = await listListingsRoute(new Request(`http://x/api/listings?date=${todaySgt()}`));
    const list = await listRes.json();
    expect(list.data).toHaveLength(1);
    expect(JSON.stringify(list.data)).not.toContain("+6591234567");

    const revealRes = await revealRoute(req(`http://x/api/listings/${data.id}/reveal`, "POST"), params({ id: data.id }));
    expect((await revealRes.json()).data.phone).toBe("+6591234567");

    const mg = await manageGet(req(`http://x/api/manage/${data.editToken}`, "GET"), params({ token: data.editToken }));
    expect((await mg.json()).data.type).toBe("listing");

    const mp = await managePatch(req(`http://x/api/manage/${data.editToken}`, "PATCH"), params({ token: data.editToken }));
    expect(mp.status).toBe(200);
    expect((await prisma.listing.findFirstOrThrow()).status).toBe("SOLD");

    const md = await manageDelete(req(`http://x/api/manage/${data.editToken}`, "DELETE"), params({ token: data.editToken }));
    expect(md.status).toBe(200);
    expect(await prisma.listing.count()).toBe(0);
  });

  it("PATCH with a playersNeeded body updates a session; PATCH without body still closes", async () => {
    const venue = await makeVenue();
    const createRes = await createSessionRoute(req("http://x/api/sessions", "POST", {
      venueId: venue.id, date: todaySgt(), startTime: "18:00", endTime: "20:00",
      playersNeeded: 2, skillLevel: "MID_INTERMEDIATE", pricePerPlayerCents: null,
      phone: "+6591234567", website: "",
    }));
    const { data } = await createRes.json();

    const upd = await managePatch(
      req(`http://x/api/manage/${data.editToken}`, "PATCH", { playersNeeded: 4 }),
      params({ token: data.editToken }),
    );
    expect(upd.status).toBe(200);
    expect((await prisma.gameSession.findFirstOrThrow()).playersNeeded).toBe(4);
    expect((await prisma.gameSession.findFirstOrThrow()).status).toBe("OPEN");

    const close = await managePatch(
      req(`http://x/api/manage/${data.editToken}`, "PATCH"),
      params({ token: data.editToken }),
    );
    expect(close.status).toBe(200);
    expect((await prisma.gameSession.findFirstOrThrow()).status).toBe("FILLED");
  });

  it("PATCH with a playersNeeded body on a listing → 400", async () => {
    const venue = await makeVenue();
    const createRes = await createListingRoute(req("http://x/api/listings", "POST", {
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 0, phone: "+6591234567", website: "",
    }));
    const { data } = await createRes.json();

    const res = await managePatch(
      req(`http://x/api/manage/${data.editToken}`, "PATCH", { playersNeeded: 4 }),
      params({ token: data.editToken }),
    );
    expect(res.status).toBe(400);
    expect((await prisma.listing.findFirstOrThrow()).status).toBe("AVAILABLE");
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
      priceCents: 0, phone: "+6591234567", website: "http://spam.example",
    }));
    expect(res.status).toBe(201);
    expect(await prisma.listing.count()).toBe(0);
  });

  it("manage 404s for unknown token", async () => {
    const t = "00000000-0000-0000-0000-000000000000";
    const res = await manageGet(req(`http://x/api/manage/${t}`, "GET"), params({ token: t }));
    expect(res.status).toBe(404);
  });

  it("report is idempotent per ip, but a different ip adds a second flag", async () => {
    const venue = await makeVenue();
    const createRes = await createListingRoute(req("http://x/api/listings", "POST", {
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 1600, phone: "+6591234567", website: "",
    }));
    const { data } = await createRes.json();

    const r1 = await reportRoute(req(`http://x/api/listings/${data.id}/report`, "POST", undefined, "5.5.5.5"), params({ id: data.id }));
    expect(r1.status).toBe(200);
    expect((await r1.json()).data.reported).toBe(true);

    const r2 = await reportRoute(req(`http://x/api/listings/${data.id}/report`, "POST", undefined, "5.5.5.5"), params({ id: data.id }));
    expect(r2.status).toBe(200);
    expect(await prisma.reportFlag.count()).toBe(1);

    const r3 = await reportRoute(req(`http://x/api/listings/${data.id}/report`, "POST", undefined, "6.6.6.6"), params({ id: data.id }));
    expect(r3.status).toBe(200);
    expect(await prisma.reportFlag.count()).toBe(2);
  });
});

describe("sessions API", () => {
  it("POST create → GET board (no phone) → reveal", async () => {
    const venue = await makeVenue();
    const body = {
      venueId: venue.id, date: todaySgt(), startTime: "18:00", endTime: "20:00",
      playersNeeded: 2, skillLevel: "MID_INTERMEDIATE", pricePerPlayerCents: 400,
      phone: "+6591234567", website: "",
    };

    const createRes = await createSessionRoute(req("http://x/api/sessions", "POST", body));
    expect(createRes.status).toBe(201);
    const { data } = await createRes.json();
    expect(data.editToken).toBeTruthy();

    const listRes = await listSessionsRoute(new Request(`http://x/api/sessions?date=${todaySgt()}`));
    const listJson = await listRes.json();
    expect(JSON.stringify(listJson)).not.toContain("+6591234567");

    const revealRes = await sessionRevealRoute(req(`http://x/api/sessions/${data.id}/reveal`, "POST"), params({ id: data.id }));
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
