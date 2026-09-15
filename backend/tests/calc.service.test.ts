import { describe, expect, it } from "vitest";
import {
  calculateBmr,
  calculateTdee,
  calculateCalorieTarget,
  calculateMacros,
  ageFromDateOfBirth,
  lbToKg,
  kgToLb,
  inToCm,
  cmToIn
} from "../src/modules/calc/calc.service.js";
import type { CalcInput } from "../src/modules/calc/calc.types.js";

const baseInput: CalcInput = {
  weightKg: 70,
  heightCm: 175,
  ageYears: 30,
  sex: "MALE",
  activityLevel: "MODERATE",
  goal: "MAINTAIN"
};

describe("calculateBmr", () => {
  it("matches Mifflin-St Jeor for a male", () => {
    // 10*70 + 6.25*175 - 5*30 + 5 = 1648.75
    expect(calculateBmr(baseInput)).toBeCloseTo(1648.75, 1);
  });

  it("matches Mifflin-St Jeor for a female", () => {
    // 10*70 + 6.25*175 - 5*30 - 161 = 1482.75
    expect(calculateBmr({ ...baseInput, sex: "FEMALE" })).toBeCloseTo(1482.75, 1);
  });

  it("never returns a negative BMR at extreme low bounds", () => {
    const result = calculateBmr({ ...baseInput, weightKg: 20, heightCm: 90, ageYears: 120 });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("rejects zero weight", () => {
    expect(() => calculateBmr({ ...baseInput, weightKg: 0 })).toThrow();
  });

  it("rejects negative height", () => {
    expect(() => calculateBmr({ ...baseInput, heightCm: -10 })).toThrow();
  });

  it("rejects NaN input", () => {
    expect(() => calculateBmr({ ...baseInput, weightKg: NaN })).toThrow();
  });

  it("rejects Infinity input", () => {
    expect(() => calculateBmr({ ...baseInput, weightKg: Infinity })).toThrow();
  });

  it("rejects out-of-range weight (too high)", () => {
    expect(() => calculateBmr({ ...baseInput, weightKg: 1000 })).toThrow();
  });

  it("rejects out-of-range age (too young for calculator)", () => {
    expect(() => calculateBmr({ ...baseInput, ageYears: 5 })).toThrow();
  });

  it("accepts decimal weight/height", () => {
    expect(() => calculateBmr({ ...baseInput, weightKg: 70.4, heightCm: 175.6 })).not.toThrow();
  });
});

describe("calculateTdee", () => {
  it("applies the sedentary multiplier", () => {
    const bmr = calculateBmr({ ...baseInput, activityLevel: "SEDENTARY" });
    const tdee = calculateTdee({ ...baseInput, activityLevel: "SEDENTARY" });
    expect(tdee).toBeCloseTo(bmr * 1.2, 1);
  });

  it("applies the very-active multiplier", () => {
    const bmr = calculateBmr({ ...baseInput, activityLevel: "VERY_ACTIVE" });
    const tdee = calculateTdee({ ...baseInput, activityLevel: "VERY_ACTIVE" });
    expect(tdee).toBeCloseTo(bmr * 1.9, 1);
  });
});

describe("calculateCalorieTarget", () => {
  it("subtracts ~500 for a lose goal", () => {
    const maintain = calculateCalorieTarget({ ...baseInput, goal: "MAINTAIN" });
    const lose = calculateCalorieTarget({ ...baseInput, goal: "LOSE" });
    expect(maintain - lose).toBeCloseTo(500, 1);
  });

  it("adds ~500 for a gain goal", () => {
    const maintain = calculateCalorieTarget({ ...baseInput, goal: "MAINTAIN" });
    const gain = calculateCalorieTarget({ ...baseInput, goal: "GAIN" });
    expect(gain - maintain).toBeCloseTo(500, 1);
  });

  it("never drops below the safety floor even for a very small, sedentary person losing weight", () => {
    const target = calculateCalorieTarget({
      weightKg: 20,
      heightCm: 90,
      ageYears: 70,
      sex: "FEMALE",
      activityLevel: "SEDENTARY",
      goal: "LOSE"
    });
    expect(target).toBeGreaterThanOrEqual(1200);
  });
});

describe("calculateMacros", () => {
  it("splits calories 30/40/30 and stays within rounding of the total", () => {
    const macros = calculateMacros(2000);
    const kcalFromMacros = macros.proteinG * 4 + macros.carbG * 4 + macros.fatG * 9;
    expect(kcalFromMacros).toBeCloseTo(2000, 0);
  });

  it("rejects a zero calorie target", () => {
    expect(() => calculateMacros(0)).toThrow();
  });
});

describe("ageFromDateOfBirth", () => {
  it("computes age correctly before this year's birthday", () => {
    const dob = new Date(Date.UTC(2000, 5, 15));
    const at = new Date(Date.UTC(2024, 5, 14));
    expect(ageFromDateOfBirth(dob, at)).toBe(23);
  });

  it("computes age correctly on/after this year's birthday", () => {
    const dob = new Date(Date.UTC(2000, 5, 15));
    const at = new Date(Date.UTC(2024, 5, 15));
    expect(ageFromDateOfBirth(dob, at)).toBe(24);
  });
});

describe("unit conversion round-trips", () => {
  it("converts lb -> kg -> lb within rounding tolerance", () => {
    expect(kgToLb(lbToKg(150))).toBeCloseTo(150, 0);
  });

  it("converts in -> cm -> in within rounding tolerance", () => {
    expect(cmToIn(inToCm(70))).toBeCloseTo(70, 0);
  });

  it("rejects negative and zero conversions", () => {
    expect(() => lbToKg(-5)).toThrow();
    expect(() => inToCm(0)).toThrow();
  });
});
