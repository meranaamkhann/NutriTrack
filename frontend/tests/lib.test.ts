import { describe, expect, it } from "vitest";
import { addDays, loggedAtFor, toDateString, todayString } from "../src/lib/dates";
import { formatAmount, kcal, unitLabel } from "../src/lib/format";
import { cmToDisplay, displayToCm, displayToKg, kgToDisplay } from "../src/lib/units";

describe("dates", () => {
  it("steps across month and year boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formats a local calendar day without UTC drift", () => {
    expect(toDateString(new Date(2026, 9, 9, 23, 59))).toBe("2026-10-09");
    expect(toDateString(new Date(2026, 9, 9, 0, 1))).toBe("2026-10-09");
  });

  it("logs 'now' for today and midday for any other day", () => {
    const now = new Date(loggedAtFor(todayString())).getTime();
    expect(Math.abs(now - Date.now())).toBeLessThan(5000);
    const past = new Date(loggedAtFor("2026-01-15"));
    expect(past.getHours()).toBe(12);
    expect(toDateString(past)).toBe("2026-01-15");
  });
});

describe("formatting", () => {
  it("shows the unit next to the amount, with sensible plurals", () => {
    expect(formatAmount(200, "G")).toBe("200 g");
    expect(formatAmount(1, "PIECE")).toBe("1 piece");
    expect(formatAmount(3, "PIECE")).toBe("3 pieces");
    expect(formatAmount(1, "SERVING")).toBe("1 serving");
    expect(formatAmount(1.5, "SERVING")).toBe("1.5 servings");
    expect(unitLabel("ML")).toBe("ml");
  });

  it("groups thousands", () => {
    expect(kcal(1871.4)).toBe((1871).toLocaleString());
  });
});

describe("unit conversion", () => {
  it("round-trips imperial values closely enough to be invisible", () => {
    expect(kgToDisplay(displayToKg(180, "IMPERIAL"), "IMPERIAL")).toBeCloseTo(180, 1);
    expect(cmToDisplay(displayToCm(70, "IMPERIAL"), "IMPERIAL")).toBeCloseTo(70, 1);
    expect(displayToKg(80, "METRIC")).toBe(80);
  });
});
