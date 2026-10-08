import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/api";
import { useToast } from "../lib/toast";
import { useCreateLog, useCurrentGoal, useDeleteLog, useFoodSearch, useTodayLogs, useUpdateLog, qk } from "../lib/queries";
import type { Food, FoodLog, MealType } from "../lib/types";
import { Button, EmptyState, ErrorText, Field, Input, PageHeader, Panel, Select } from "../components/ui";
import { CalorieRing } from "../components/CalorieRing";
import { MacroBar } from "../components/MacroBar";
import { ListSkeleton, PanelSkeleton } from "../components/Skeleton";

const MEALS: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];
const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
  CUSTOM: "Other"
};

// A reasonable default so the meal selector doesn't always start on
// Breakfast regardless of when you're actually logging something.
function defaultMealForNow(): MealType {
  const hour = new Date().getHours();
  if (hour < 11) return "BREAKFAST";
  if (hour < 16) return "LUNCH";
  if (hour < 21) return "DINNER";
  return "SNACK";
}

export function Dashboard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const today = useMemo(() => new Date().toISOString(), []);
  const dateKey = today.slice(0, 10);

  const logsQuery = useTodayLogs(today);
  const goalQuery = useCurrentGoal();
  const deleteLog = useDeleteLog();
  const [showAdd, setShowAdd] = useState(false);

  const logs = logsQuery.data ?? [];
  const goal = goalQuery.data ?? null;

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

  function removeLog(id: string) {
    const key = qk.logsForDate(dateKey);
    const previous = qc.getQueryData<FoodLog[]>(key);
    qc.setQueryData<FoodLog[]>(key, (old) => old?.filter((l) => l.id !== id));
    deleteLog.mutate(id, {
      onError: (err) => {
        qc.setQueryData(key, previous);
        push("error", err instanceof ApiError ? err.message : "Could not remove that entry");
      }
    });
  }

  const byMeal = MEALS.map((meal) => ({ meal, items: logs.filter((l) => l.meal === meal) }));
  const loading = logsQuery.isLoading || goalQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      />
      {logsQuery.isError && <ErrorText>Could not load today's log.</ErrorText>}

      {goalQuery.isLoading ? (
        <div className="mb-6">
          <PanelSkeleton />
        </div>
      ) : (
        <Panel className="mb-6">
          <CalorieRing consumed={totals.calories} target={goal ? Number(goal.calorieTarget) : null} />
          <div className="mt-5 grid grid-cols-3 gap-4">
            <MacroBar label="Protein" grams={totals.proteinG} targetGrams={goal ? Number(goal.proteinGTarget) : undefined} colorClass="bg-pine" />
            <MacroBar label="Carbs" grams={totals.carbG} targetGrams={goal ? Number(goal.carbGTarget) : undefined} colorClass="bg-gold" />
            <MacroBar label="Fat" grams={totals.fatG} targetGrams={goal ? Number(goal.fatGTarget) : undefined} colorClass="bg-brick" />
          </div>
          {!goal && (
            <p className="mt-4 text-sm text-ink-soft">
              No calorie target yet —{" "}
              <a href="/settings" className="font-medium text-pine">
                set up your profile in Settings
              </a>{" "}
              to get one calculated for you.
            </p>
          )}
        </Panel>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Log</h2>
        <div className="flex gap-2">
          <Link to="/quick-add">
            <Button variant="secondary">Quick add</Button>
          </Link>
          <Button onClick={() => setShowAdd((s) => !s)}>{showAdd ? "Close" : "+ Add food"}</Button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-6">
          <AddFoodForm
            onAdded={() => {
              setShowAdd(false);
              push("success", "Added to today's log.");
            }}
          />
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={3} />
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
                    <LogRow key={log.id} log={log} onRemove={() => removeLog(log.id)} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function LogRow({ log, onRemove }: { log: FoodLog; onRemove: () => void }) {
  const { push } = useToast();
  const updateLog = useUpdateLog();
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(String(Number(log.quantity)));

  function save() {
    const value = Number(quantity);
    if (!value || value <= 0) return;
    updateLog.mutate(
      { id: log.id, quantity: value },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => push("error", err instanceof ApiError ? err.message : "Could not update that entry")
      }
    );
  }

  if (editing) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="flex-1 text-sm font-medium text-ink">{log.foodNameSnapshot}</p>
        <Input
          type="number"
          step="0.1"
          min="0.1"
          autoFocus
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-20"
        />
        <button onClick={save} disabled={updateLog.isPending} className="text-xs font-medium text-pine hover:underline">
          {updateLog.isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setQuantity(String(Number(log.quantity)));
          }}
          className="text-xs font-medium text-ink-soft hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{log.foodNameSnapshot}</p>
        <p className="text-xs text-ink-soft">
          {Number(log.quantity)}
          {log.entrySource === "AI_ESTIMATED" ? " · AI estimate" : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink">{Math.round(Number(log.caloriesSnapshot))} kcal</span>
        <button onClick={() => setEditing(true)} className="text-xs font-medium text-pine hover:underline">
          Edit
        </button>
        <button onClick={onRemove} className="text-xs font-medium text-brick hover:underline">
          Remove
        </button>
      </div>
    </div>
  );
}

function AddFoodForm({ onAdded }: { onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [meal, setMeal] = useState<MealType>(defaultMealForNow());
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const searchQuery = useFoodSearch(debouncedQuery);
  const createLog = useCreateLog();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounced separately from `query` so the input stays instantly
  // responsive while the network request only fires 200ms after typing
  // stops — each keystroke cancels the previous pending fetch.
  function onQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(value), 200);
  }

  const results = selected ? [] : searchQuery.data ?? [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    createLog.mutate(
      {
        foodId: selected.id,
        quantity: Number(quantity),
        meal,
        loggedAt: new Date().toISOString(),
        idempotencyKey
      },
      {
        onSuccess: () => onAdded(),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add food")
      }
    );
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorText>{error}</ErrorText>
        <Field label="Search your foods">
          <Input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="e.g. chicken breast" />
        </Field>
        {results.length > 0 && !selected && (
          <div className="divide-y divide-line rounded-md border border-line">
            {results.map((food) => (
              <button
                type="button"
                key={food.id}
                onClick={() => {
                  setSelected(food);
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
        <Button type="submit" disabled={!selected || createLog.isPending}>
          {createLog.isPending ? "Adding…" : "Add to log"}
        </Button>
      </form>
    </Panel>
  );
}
