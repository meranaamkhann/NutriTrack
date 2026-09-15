import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Food, FoodLog, GoalHistoryEntry, MealType } from "../lib/types";
import { Button, EmptyState, ErrorText, Field, Input, PageHeader, Panel, Select } from "../components/ui";
import { CalorieRing } from "../components/CalorieRing";
import { MacroBar } from "../components/MacroBar";

const MEALS: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];
const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
  CUSTOM: "Other"
};

export function Dashboard() {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [goal, setGoal] = useState<GoalHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  const today = useMemo(() => new Date().toISOString(), []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [logsRes, goalRes] = await Promise.all([
        api.get<FoodLog[]>("/logs", { date: today }),
        api.get<GoalHistoryEntry | null>("/users/me/goals/current")
      ]);
      setLogs(logsRes);
      setGoal(goalRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load today");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = logs.reduce(
    (acc, log) => {
      acc.calories += Number(log.caloriesSnapshot);
      acc.proteinG += Number(log.proteinGSnapshot);
      acc.carbG += Number(log.carbGSnapshot);
      acc.fatG += Number(log.fatGSnapshot);
      return acc;
    },
    { calories: 0, proteinG: 0, carbG: 0, fatG: 0 }
  );

  async function deleteLog(id: string) {
    await api.delete(`/logs/${id}`);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  const byMeal = MEALS.map((meal) => ({ meal, items: logs.filter((l) => l.meal === meal) }));

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      />
      <ErrorText>{error}</ErrorText>

      <Panel className="mb-6">
        <CalorieRing consumed={totals.calories} target={goal ? Number(goal.calorieTarget) : null} />
        <div className="mt-5 grid grid-cols-3 gap-4">
          <MacroBar label="Protein" grams={totals.proteinG} targetGrams={goal ? Number(goal.proteinGTarget) : undefined} colorClass="bg-pine" />
          <MacroBar label="Carbs" grams={totals.carbG} targetGrams={goal ? Number(goal.carbGTarget) : undefined} colorClass="bg-gold" />
          <MacroBar label="Fat" grams={totals.fatG} targetGrams={goal ? Number(goal.fatGTarget) : undefined} colorClass="bg-brick" />
        </div>
        {!goal && (
          <p className="mt-4 text-sm text-ink-soft">
            No calorie target yet — set up your profile in Settings to get one calculated for you.
          </p>
        )}
      </Panel>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Log</h2>
        <Button onClick={() => setShowAdd((s) => !s)}>{showAdd ? "Close" : "+ Add food"}</Button>
      </div>

      {showAdd && (
        <div className="mb-6">
          <AddFoodForm
            onAdded={() => {
              setShowAdd(false);
              load();
            }}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : logs.length === 0 ? (
        <EmptyState title="Nothing logged yet" body="Add your first food above to start tracking today." />
      ) : (
        <div className="flex flex-col gap-6">
          {byMeal
            .filter((m) => m.items.length > 0)
            .map((m) => (
              <div key={m.meal}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                  {MEAL_LABELS[m.meal]}
                </h3>
                <div className="divide-y divide-line rounded-lg border border-line bg-white">
                  {m.items.map((log) => (
                    <div key={log.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink">{log.foodNameSnapshot}</p>
                        <p className="text-xs text-ink-soft">
                          {Number(log.quantity)}
                          {log.entrySource === "AI_ESTIMATED" ? " · AI estimate" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-ink">{Math.round(Number(log.caloriesSnapshot))} kcal</span>
                        <button
                          onClick={() => deleteLog(log.id)}
                          className="text-xs font-medium text-brick hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function AddFoodForm({ onAdded }: { onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [meal, setMeal] = useState<MealType>("BREAKFAST");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.get<Food[]>("/foods", { q: query, limit: 8 }).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSubmitting(true);
    try {
      await api.post("/logs", {
        foodId: selected.id,
        quantity: Number(quantity),
        meal,
        loggedAt: new Date().toISOString()
      });
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add food");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorText>{error}</ErrorText>
        <Field label="Search your foods">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="e.g. chicken breast"
          />
        </Field>
        {results.length > 0 && !selected && (
          <div className="divide-y divide-line rounded-md border border-line">
            {results.map((food) => (
              <button
                type="button"
                key={food.id}
                onClick={() => {
                  setSelected(food);
                  setResults([]);
                  setQuery(food.name);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-paper"
              >
                <span>{food.name}</span>
                <span className="text-ink-soft">
                  {Number(food.calories)} kcal / {Number(food.servingSize)}
                  {food.servingUnit.toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="flex gap-4">
            <Field label={`Quantity (${selected.servingUnit.toLowerCase()})`}>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Field label="Meal">
              <Select value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
                {MEALS.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        <Button type="submit" disabled={!selected || submitting}>
          {submitting ? "Adding…" : "Add to log"}
        </Button>
      </form>
    </Panel>
  );
}
