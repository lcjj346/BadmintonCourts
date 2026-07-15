/** @jest-environment node */
import dayjs from "dayjs";
import {
  todaySgt, maxPostDateSgt, dateToStr, strToDate,
  timeBucket, formatPrice, formatDateLabel,
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

  it("labels today as Today and never Tmrw, otherwise ddd D MMM", () => {
    const today = todaySgt();
    const tomorrow = dayjs(today).add(1, "day").format("YYYY-MM-DD");
    expect(formatDateLabel(today)).toBe("Today");
    expect(formatDateLabel(tomorrow)).not.toBe("Tmrw");
    expect(formatDateLabel(tomorrow)).toBe(dayjs(tomorrow).format("ddd D MMM"));
  });

  it("formats prices", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(null)).toBe("Negotiable");
    expect(formatPrice(1600)).toBe("$16");
    expect(formatPrice(1650)).toBe("$16.50");
  });
});
