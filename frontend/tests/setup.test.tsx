import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Setup } from "../src/pages/Setup";
import { mockApi, renderApp } from "./helpers";

const preview = { bmr: 1800, tdee: 2790, calorieTarget: 2290, proteinG: 172, carbG: 229, fatG: 76 };

function routes(extra: Record<string, (url: URL, init?: RequestInit) => unknown> = {}) {
  return {
    "GET /users/me": () => ({ displayName: null, dateOfBirth: null, sexForCalc: null, heightCm: null, unitPref: "METRIC", goal: "MAINTAIN", activityLevel: "MODERATE", targetWeightKg: null }),
    "GET /weights": () => [],
    "POST /users/me/goals/preview": () => preview,
    "POST /users/me/setup": () => ({ profile: {}, goal: { calorieTarget: preview.calorieTarget } }),
    "POST /users/me/goals/manual": () => ({ calorieTarget: 2100 }),
    ...extra
  };
}

async function fillStepOne() {
  await screen.findByText("About you");
  fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1998-04-12" } });
  fireEvent.click(screen.getByRole("button", { name: "Male" }));
  fireEvent.change(screen.getByLabelText("Height (cm)"), { target: { value: "178" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("setup wizard", () => {
  it("won't continue until the basics are filled in, and says what's missing", async () => {
    mockApi(routes());
    renderApp(<Setup />);
    await screen.findByText("About you");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/date of birth/i);
  });

  it("refuses an under-13 birth date before calling the server", async () => {
    const calls = mockApi(routes());
    renderApp(<Setup />);
    await screen.findByText("About you");
    const recent = new Date(Date.now() - 5 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: recent } });
    fireEvent.click(screen.getByRole("button", { name: "Male" }));
    fireEvent.change(screen.getByLabelText("Height (cm)"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/13 or older/);
    expect(calls.some((c) => c.path === "/users/me/goals/preview")).toBe(false);
  });

  it("walks through, previews the calculation, and saves it with the browser's timezone", async () => {
    const calls = mockApi(routes());
    renderApp(<Setup />);
    await fillStepOne();

    await screen.findByText("Your goal");
    fireEvent.change(screen.getByLabelText("Current weight (kg)"), { target: { value: "82" } });
    fireEvent.click(screen.getByRole("button", { name: /Lose weight/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Your daily target");
    expect((screen.getByLabelText("Daily calorie target") as HTMLInputElement).value).toBe("2290");
    fireEvent.click(screen.getByRole("button", { name: "Use this target" }));

    await waitFor(() => expect(calls.some((c) => c.path === "/users/me/setup")).toBe(true));
    const body = calls.find((c) => c.path === "/users/me/setup")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ sexForCalc: "MALE", heightCm: 178, weightKg: 82, goal: "LOSE", unitPref: "METRIC", dateOfBirth: "1998-04-12" });
    expect(typeof body.timezone).toBe("string");
    // accepting the suggestion must NOT create a separate manual target
    expect(calls.some((c) => c.path === "/users/me/goals/manual")).toBe(false);
  });

  it("saves your own number as a manual target when you change the suggestion", async () => {
    const calls = mockApi(routes());
    renderApp(<Setup />);
    await fillStepOne();
    await screen.findByText("Your goal");
    fireEvent.change(screen.getByLabelText("Current weight (kg)"), { target: { value: "82" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Your daily target");
    fireEvent.change(screen.getByLabelText("Daily calorie target"), { target: { value: "2100" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this target" }));

    await waitFor(() => expect(calls.some((c) => c.path === "/users/me/goals/manual")).toBe(true));
    expect(calls.find((c) => c.path === "/users/me/goals/manual")!.body).toEqual({ calorieTarget: 2100 });
  });

  it("warns about very low targets", async () => {
    mockApi(routes());
    renderApp(<Setup />);
    await fillStepOne();
    await screen.findByText("Your goal");
    fireEvent.change(screen.getByLabelText("Current weight (kg)"), { target: { value: "82" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Your daily target");
    fireEvent.change(screen.getByLabelText("Daily calorie target"), { target: { value: "1000" } });
    expect(screen.getByText(/isn't generally recommended/)).toBeTruthy();
  });

  it("converts what you've typed when you switch to imperial, instead of reinterpreting it", async () => {
    mockApi(routes());
    renderApp(<Setup />);
    await screen.findByText("About you");
    fireEvent.change(screen.getByLabelText("Height (cm)"), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: /Imperial/ }));
    const height = screen.getByLabelText("Height (in)") as HTMLInputElement;
    expect(Number(height.value)).toBeCloseTo(70.9, 1);
  });
});
