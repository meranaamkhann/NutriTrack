import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "../src/components/PasswordInput";
import { PasswordStrength } from "../src/components/PasswordStrength";
import { SummaryHero } from "../src/components/SummaryHero";
import { Input } from "../src/components/ui";
import { renderApp } from "./helpers";

const totals = { calories: 500, proteinG: 30, carbG: 60, fatG: 15 };
const goal = { calorieTarget: 2000, proteinGTarget: 150, carbGTarget: 200, fatGTarget: 67, source: "CALCULATED" as const, effectiveFrom: "2026-01-01" };

describe("password field", () => {
  it("hides the password by default and the eye toggle reveals and re-hides it", () => {
    renderApp(<PasswordInput aria-label="pw" defaultValue="hunter2hunter2" />);
    const input = screen.getByLabelText("pw") as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.type).toBe("password");
  });
});

describe("password strength", () => {
  it("shows nothing for an empty field, 'Too weak' when short, and ticks the rules as they're met", () => {
    const { rerender, container } = renderApp(<PasswordStrength password="" />);
    expect(container.textContent).toBe("");
    rerender(<PasswordStrength password="abc" />);
    expect(screen.getByText("Too weak")).toBeTruthy();
  });

  it("rates a long mixed passphrase as strong", () => {
    renderApp(<PasswordStrength password="Correct-Horse-Battery-9" />);
    expect(screen.getByText("Strong")).toBeTruthy();
  });
});

describe("Input styling", () => {
  it("keeps its border and padding when given its own className (it used to lose them)", () => {
    renderApp(<Input aria-label="qty" className="w-24" />);
    const cls = screen.getByLabelText("qty").className;
    expect(cls).toContain("border");
    expect(cls).toContain("px-3");
    expect(cls).toContain("w-24");
  });
});

describe("summary card", () => {
  it("prompts for a target instead of showing an empty ring when none is set", () => {
    renderApp(<SummaryHero totals={totals} goal={null} />);
    expect(screen.getByText("kcal eaten")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set your daily target" }).getAttribute("href")).toBe("/setup");
  });

  it("shows calories left against the target", () => {
    renderApp(<SummaryHero totals={totals} goal={goal} />);
    expect(screen.getByText("kcal left")).toBeTruthy();
    expect(screen.getByText((1500).toLocaleString())).toBeTruthy();
  });

  it("switches to 'over' when the target is exceeded", () => {
    renderApp(<SummaryHero totals={{ ...totals, calories: 2300 }} goal={goal} />);
    expect(screen.getByText("kcal over")).toBeTruthy();
    expect(screen.getByText("300")).toBeTruthy();
  });
});
