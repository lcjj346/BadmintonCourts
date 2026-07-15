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
