export default function Loading() {
  return (
    <main aria-busy="true" role="status">
      <span className="sr-only">Loading…</span>

      <header className="flex items-center justify-between pt-4">
        <div className="skeleton h-6 w-32 rounded" />
        <div className="skeleton h-6 w-20 rounded" />
      </header>

      <div className="mt-2 flex gap-4 border-b border-gray-200 pb-2">
        <div className="skeleton h-5 w-14 rounded" />
        <div className="skeleton h-5 w-14 rounded" />
      </div>

      <div className="flex gap-2 overflow-hidden pb-3 pt-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-16 shrink-0 rounded-full" />
        ))}
      </div>

      <div className="flex gap-2 overflow-hidden pb-3 pt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-7 w-20 shrink-0 rounded-full" />
        ))}
      </div>

      <div className="mt-2 space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[72px] rounded-xl" />
        ))}
      </div>
    </main>
  );
}
