import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dashboard } from "../src/pages/Dashboard";
import { addDays, todayString } from "../src/lib/dates";
import { mockApi, renderApp } from "./helpers";

const today = todayString();
const yesterday = addDays(today, -1);

const oats = { id: "food-oats", name: "Oats", servingSize: "50", servingUnit: "G", calories: "190", proteinG: "7", carbG: "33", fatG: "3", ownerId: "u1" };

function diaryFor(date: string) {
  if (date !== today) return { date, entries: [], goal: null };
  return {
    date,
    goal: { calorieTarget: 2000, proteinGTarget: 150, carbGTarget: 200, fatGTarget: 67, source: "CALCULATED", effectiveFrom: "2026-01-01" },
    entries: [
      { id: "f1", kind: "FOOD", name: "Oats", amount: 50, unit: "G", calories: 190, proteinG: 7, carbG: 33, fatG: 3, meal: "BREAKFAST", loggedAt: new Date().toISOString(), source: "MANUAL" },
      { id: "r1", kind: "RECIPE", name: "Chicken Biryani", amount: 1.5, unit: "SERVING", calories: 600, proteinG: 40, carbG: 70, fatG: 18, meal: "LUNCH", loggedAt: new Date().toISOString(), source: "MANUAL" }
    ]
  };
}

function baseRoutes(extra: Record<string, (url: URL, init?: RequestInit) => unknown> = {}) {
  return {
    "GET /diary": (url: URL) => diaryFor(url.searchParams.get("date")!),
    "GET /users/me": () => ({ displayName: "Asad", unitPref: "METRIC" }),
    "GET /foods/recent": () => [oats],
    "GET /foods": () => [oats],
    ...extra
  };
}

describe("Today / diary page", () => {
  it("shows foods AND recipes together, with units, subtotals and calories left", async () => {
    mockApi(baseRoutes());
    renderApp(<Dashboard />);

    expect(await screen.findByText("Chicken Biryani")).toBeTruthy();
    expect(screen.getByText("Recipe")).toBeTruthy();
    expect(screen.getByText(/1\.5 servings/)).toBeTruthy();
    expect(screen.getByText(/^50 g ·/)).toBeTruthy();
    expect(screen.getByText((1210).toLocaleString())).toBeTruthy();
    expect(screen.getByText("kcal left")).toBeTruthy();
    expect(await screen.findByText(/Asad/)).toBeTruthy();
    for (const meal of ["Breakfast", "Lunch", "Dinner", "Snacks"]) expect(screen.getByText(meal)).toBeTruthy();
  });

  it("can't go past today, but can step back a day and shows that day's diary", async () => {
    const calls = mockApi(baseRoutes());
    renderApp(<Dashboard />);
    await screen.findByText("Chicken Biryani");

    expect((screen.getByRole("button", { name: "Next day" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));

    expect(await screen.findByText("Yesterday")).toBeTruthy();
    await waitFor(() => expect(calls.some((c) => c.path === "/diary" && c.search.includes(`date=${yesterday}`))).toBe(true));
    await waitFor(() => expect(screen.queryByText("Chicken Biryani")).toBeNull());
    expect(screen.getByText("Back to today")).toBeTruthy();
  });

  it("removes a recipe entry at once and calls the recipe-log endpoint (a food calls /logs)", async () => {
    const deleted = new Set<string>();
    const calls = mockApi(
      baseRoutes({
        "GET /diary": (url: URL) => {
          const day = diaryFor(url.searchParams.get("date")!);
          return { ...day, entries: day.entries.filter((e) => !deleted.has(e.id)) };
        },
        "DELETE /diary/recipe-logs/:id": (url: URL) => void deleted.add(url.pathname.split("/").pop()!),
        "DELETE /logs/:id": (url: URL) => void deleted.add(url.pathname.split("/").pop()!)
      })
    );
    renderApp(<Dashboard />);
    await screen.findByText("Chicken Biryani");

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(removeButtons[1]);
    await waitFor(() => expect(screen.queryByText("Chicken Biryani")).toBeNull());
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/diary/recipe-logs/r1")).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/logs/f1")).toBe(true));
  });

  it("puts a removed entry back and says so when the server refuses", async () => {
    mockApi(baseRoutes({ "DELETE /diary/recipe-logs/:id": () => ({ __status: 500, body: { message: "Database is down" } }) }));
    renderApp(<Dashboard />);
    await screen.findByText("Chicken Biryani");

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    expect(await screen.findByText("Database is down")).toBeTruthy();
    expect(await screen.findByText("Chicken Biryani")).toBeTruthy();
  });

  it("adds a recent food in two taps, to today", async () => {
    const calls = mockApi(baseRoutes({ "POST /logs": () => ({ id: "new" }) }));
    renderApp(<Dashboard />);
    await screen.findByText("Chicken Biryani");

    fireEvent.click(screen.getByRole("button", { name: "+ Add food" }));
    expect(await screen.findByText("Recent")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /Oats/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to diary" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/logs")).toBe(true));
    const body = calls.find((c) => c.method === "POST" && c.path === "/logs")!.body as Record<string, unknown>;
    expect(body.foodId).toBe("food-oats");
    expect(body.quantity).toBe(50);
    expect(body.loggedDate).toBe(today);
    expect(typeof body.idempotencyKey).toBe("string");
  });

  it("logs to the day being viewed and the meal whose + was pressed", async () => {
    const calls = mockApi(baseRoutes({ "POST /logs": () => ({ id: "new" }) }));
    renderApp(<Dashboard />);
    await screen.findByText("Chicken Biryani");

    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    await screen.findByText("Yesterday");
    fireEvent.click(await screen.findByRole("button", { name: "Add to Lunch" }));
    fireEvent.click(await screen.findByRole("button", { name: /Oats/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to diary" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/logs")).toBe(true));
    const body = calls.find((c) => c.method === "POST" && c.path === "/logs")!.body as Record<string, unknown>;
    expect(body.loggedDate).toBe(yesterday);
    expect(body.meal).toBe("LUNCH");
  });

  it("adds a recipe from the same panel", async () => {
    const calls = mockApi(
      baseRoutes({ "GET /recipes": () => [{ id: "rec1", name: "Chicken Biryani", servings: "4" }], "POST /recipes/:id/log": () => ({ id: "x" }) })
    );
    renderApp(<Dashboard />);
    await screen.findByText("Chicken Biryani");

    fireEvent.click(screen.getByRole("button", { name: "+ Add food" }));
    fireEvent.click(screen.getByRole("tab", { name: "Recipes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/recipes/rec1/log")).toBe(true));
    const body = calls.find((c) => c.path === "/recipes/rec1/log")!.body as Record<string, unknown>;
    expect(body.servingsConsumed).toBe(1);
    expect(body.loggedDate).toBe(today);
  });

  it("invites you to set a target when there isn't one", async () => {
    mockApi(baseRoutes({ "GET /diary": () => ({ date: today, entries: [], goal: null }) }));
    renderApp(<Dashboard />);
    const link = await screen.findByRole("link", { name: "Set your daily target" });
    expect(link.getAttribute("href")).toBe("/setup");
  });
});