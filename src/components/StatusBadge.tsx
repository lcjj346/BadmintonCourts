const STYLES: Record<string, string> = {
  AVAILABLE: "bg-court-light text-court ring-court/15",
  OPEN: "bg-court-light text-court ring-court/15",
  SOLD: "bg-gray-100 text-gray-500 ring-gray-300/60",
  FILLED: "bg-gray-100 text-gray-500 ring-gray-300/60",
  EXPIRED: "bg-gray-100 text-gray-400 ring-gray-300/60",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STYLES[status] ?? ""}`}
    >
      {status}
    </span>
  );
}
