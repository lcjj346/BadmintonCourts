import Link from "next/link";
import { boardFilterSchema } from "@/lib/schemas";
import { formatDateLabel, dateToStr } from "@/lib/time";
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

  const venues = await listVenues();
  const rows = tab === "courts"
    ? await listListings(filters)
    : await listSessions(filters);

  const tabClass = (active: boolean) =>
    `border-b-2 px-3 py-2 text-sm font-semibold ${
      active ? "border-court text-court" : "border-transparent text-gray-400"
    }`;

  const dateQ = filters.date ? `&date=${filters.date}` : "";

  type Row = { id: string; date: Date };
  const list: Row[] = rows;

  const renderCard = (row: Row) =>
    tab === "courts"
      ? <ListingCard key={row.id} listing={row as Awaited<ReturnType<typeof listListings>>[number]} />
      : <SessionCard key={row.id} session={row as Awaited<ReturnType<typeof listSessions>>[number]} />;

  // When no single date is selected, group rows under date headers. Rows come back
  // ordered by date already, so a simple run-length grouping keeps order.
  const grouped = !filters.date;
  const groups: { key: string; label: string; rows: Row[] }[] = [];
  if (grouped) {
    for (const row of list) {
      const key = dateToStr(row.date);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.rows.push(row);
      else groups.push({ key, label: formatDateLabel(key), rows: [row] });
    }
  }

  return (
    <main>
      <header className="flex items-center justify-between pt-4">
        <h1 className="text-lg font-bold">🏸 BadmintonSG</h1>
        <Link href="/faq" className="text-sm font-medium text-court underline">
          FAQ
        </Link>
      </header>

      <nav className="mt-2 flex border-b border-gray-200">
        <Link href={`/?tab=courts${dateQ}`} className={tabClass(tab === "courts")}>Courts</Link>
        <Link href={`/?tab=players${dateQ}`} className={tabClass(tab === "players")}>Players</Link>
      </nav>

      <DateStrip />
      <FilterBar venues={venues} showSkill={tab === "players"} />

      {rows.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-400">
          Nothing here yet — try another date or filter, or post the first one.
        </p>
      )}

      {grouped ? (
        <div className="mt-2 space-y-4">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="sticky top-14 z-10 bg-paper/85 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 backdrop-blur">
                {g.label}
              </h2>
              <div className="space-y-2">{g.rows.map(renderCard)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-2 space-y-2">{list.map(renderCard)}</div>
      )}

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
