/** @jest-environment node */
import dayjs from "dayjs";
import {
  todaySgt, maxPostDateSgt, dateToStr, strToDate,
  formatPrice, formatDateLabel, TIME_OPTIONS, addHoursToTime,
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

  it("TIME_OPTIONS is half-hourly 07:00–23:30", () => {
    expect(TIME_OPTIONS).toHaveLength(34);
    expect(TIME_OPTIONS[0]).toBe("07:00");
    expect(TIME_OPTIONS[1]).toBe("07:30");
    expect(TIME_OPTIONS[TIME_OPTIONS.length - 1]).toBe("23:30");
  });

  it("addHoursToTime handles half-hours, long durations, and the midnight cap", () => {
    expect(addHoursToTime("12:30", 2)).toBe("14:30");
    expect(addHoursToTime("08:00", 1.5)).toBe("09:30");
    expect(addHoursToTime("09:00", 10)).toBe("19:00");
    expect(addHoursToTime("21:30", 10)).toBe("23:59"); // capped
  });
});
