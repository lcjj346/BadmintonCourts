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
