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

/** Current SGT wall-clock time as "HH:mm". */
export function nowSgtTime(): string {
  return dayjs().tz(SGT).format("HH:mm");
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

// Half-hourly start times 07:00–23:30 (some CC courts start on the half hour;
// late sessions run close to midnight).
export const TIME_OPTIONS = Array.from({ length: 34 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  return `${String(h).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`;
});

/** startTime + duration in hours → "HH:mm", capped at 23:59. */
export function addHoursToTime(startTime: string, hours: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = Math.min(h * 60 + m + Math.round(hours * 60), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
