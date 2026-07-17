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
import { OnlineCount } from "@/components/OnlineCount";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const tab = raw.tab === "players" ? "players" : "courts";
  const parsed = boardFilterSchema.safeParse(raw);
  const filters = parsed.success ? parsed.data : { date: [], region: [], skill: [] };

  const venues = await listVenues();
  const rows = tab === "courts"
    ? await listListings(filters)
    : await listSessions(filters);

  const tabClass = (active: boolean) =>
    `border-b-2 px-3 py-2 text-sm font-semibold ${
      active ? "border-court text-court" : "border-transparent text-gray-400"
    }`;

  const dateQ = filters.date.map((d) => `&date=${d}`).join("");

  type Row = { id: string; date: Date };
  const list: Row[] = rows;

  const renderCard = (row: Row) =>
    tab === "courts"
      ? <ListingCard key={row.id} listing={row as Awaited<ReturnType<typeof listListings>>[number]} />
      : <SessionCard key={row.id} session={row as Awaited<ReturnType<typeof listSessions>>[number]} />;

  // When zero or 2+ dates are selected, group rows under date headers — with exactly
  // one date picked, every row already shares it, so a header would be redundant.
  // Rows come back ordered by date already, so a simple run-length grouping keeps order.
  const grouped = filters.date.length !== 1;
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
        <h1 className="text-lg font-bold">BadmintonSG</h1>
        <div className="flex items-center gap-3">
          <OnlineCount />
          <Link href="/faq" className="text-sm font-medium text-court underline">
            FAQ
          </Link>
        </div>
      </header>

      <nav className="mt-2 flex border-b border-gray-200">
        <Link href={`/?tab=courts${dateQ}`} className={tabClass(tab === "courts")}>Courts</Link>
        <Link href={`/?tab=players${dateQ}`} className={tabClass(tab === "players")}>Players</Link>
      </nav>

      <div className="sticky top-14 z-20 -mx-4 bg-paper/95 px-4 backdrop-blur-md">
        <DateStrip />
        <FilterBar venues={venues} showSkill={tab === "players"} />
      </div>

      {/* min-h keeps a short/empty board tall enough that the footer's disclaimer text
          (in the root layout, after this page's content) doesn't end up rendering right
          behind the fixed "+" button below — that button is pinned to the viewport
          regardless of how little content there is. */}
      <div className="min-h-[60vh]">
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <p className="text-sm font-medium text-gray-500">No {tab === "courts" ? "courts" : "players"} match your filters</p>
            <p className="text-xs text-gray-400">Try another date, clear a filter, or be the first to post.</p>
          </div>
        )}

        {grouped ? (
          <div className="mt-2 space-y-4">
            {groups.map((g) => (
              <section key={g.key}>
                <h2 className="py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {g.label}
                </h2>
                <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
                  {g.rows.map(renderCard)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-2 space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
            {list.map(renderCard)}
          </div>
        )}
      </div>

      <Link
        href="/post"
        aria-label="Post"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-court text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl active:scale-95"
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </main>
  );
}
