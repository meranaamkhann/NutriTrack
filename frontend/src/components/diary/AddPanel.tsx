import { useRef, useState } from "react";
import { ApiError } from "../../lib/api";
import { loggedAtFor } from "../../lib/dates";
import { formatAmount, kcal, unitLabel } from "../../lib/format";
import { useAddFoodLog, useFoodSearch, useLogRecipe, useRecentFoods, useRecipes } from "../../lib/queries";
import type { Food, MealType, Recipe } from "../../lib/types";
import { Button, ErrorText, Field, Input, Panel, Select } from "../ui";
import { MEALS, MEAL_LABELS } from "./meals";

type Mode = "foods" | "recipes";

export function AddPanel({
  date,
  initialMeal,
  onDone,
  onClose
}: {
  date: string;
  initialMeal: MealType;
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("foods");
  const seg = (active: boolean) =>
    `px-3 py-1.5 text-sm font-bold transition-colors ${active ? "bg-ink text-white" : "text-ink hover:bg-mark"}`;

  return (
    <Panel className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex border-2 border-ink" role="tablist">
          <button role="tab" aria-selected={mode === "foods"} className={seg(mode === "foods")} onClick={() => setMode("foods")}>
            Foods
          </button>
          <button role="tab" aria-selected={mode === "recipes"} className={seg(mode === "recipes")} onClick={() => setMode("recipes")}>
            Recipes
          </button>
        </div>
        <button onClick={onClose} className="text-sm font-bold text-ink underline underline-offset-4">
          Close
        </button>
      </div>
      {mode === "foods" ? (
        <FoodAdder date={date} initialMeal={initialMeal} onDone={onDone} />
      ) : (
        <RecipeAdder date={date} initialMeal={initialMeal} onDone={onDone} />
      )}
    </Panel>
  );
}

function FoodAdder({ date, initialMeal, onDone }: { date: string; initialMeal: MealType; onDone: (m: string) => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState("");
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [error, setError] = useState("");
  // One key per add. A double-click or a retried request carries the same
  // key, so the server collapses it into a single entry.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useFoodSearch(debounced);
  const recent = useRecentFoods();
  const addLog = useAddFoodLog();

  function onQuery(value: string) {
    setQuery(value);
    setSelected(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), 200);
  }

  function choose(food: Food) {
    setSelected(food);
    setQuery(food.name);
    setQuantity(String(Number(food.servingSize)));
  }

  const showingRecent = !debounced && (recent.data?.length ?? 0) > 0;
  const results = debounced ? search.data ?? [] : showingRecent ? recent.data ?? [] : search.data ?? [];
  const qty = Number(quantity);
  const preview = selected && qty > 0 ? (Number(selected.calories) * qty) / Number(selected.servingSize) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !(qty > 0)) return;
    setError("");
    addLog.mutate(
      { foodId: selected.id, quantity: qty, meal, loggedAt: loggedAtFor(date), loggedDate: date, idempotencyKey },
      {
        onSuccess: () => {
          setIdempotencyKey(crypto.randomUUID());
          onDone(`Added ${selected.name} to ${MEAL_LABELS[meal].toLowerCase()}.`);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add that food")
      }
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <ErrorText>{error}</ErrorText>
      <Field label="Search foods">
        <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="e.g. chicken breast" autoFocus />
      </Field>

      {!selected && (
        <div>
          <p className="mb-2 text-sm font-bold text-ink">
            {debounced ? "Results" : showingRecent ? "Recent" : "Your foods"}
          </p>
          {results.length === 0 ? (
            <p className="rounded-sm border border-dashed border-line px-3 py-4 text-center text-sm text-ink-soft">
              {debounced ? "No match. Create it on the Foods page first." : "No foods yet. Create one on the Foods page."}
            </p>
          ) : (
            <div className="divide-y divide-line rounded-sm border border-line">
              {results.map((food) => (
                <button
                  type="button"
                  key={food.id}
                  onClick={() => choose(food)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-wash"
                >
                  <span className="truncate font-medium text-ink">{food.name}</span>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {kcal(Number(food.calories))} kcal · {formatAmount(Number(food.servingSize), food.servingUnit)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="flex flex-wrap items-end gap-4">
          <Field label={`Amount (${unitLabel(selected.servingUnit)})`}>
            <Input type="number" min="0.1" step="0.1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-28" />
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
          {preview !== null && <p className="pb-2 text-sm font-medium text-ink">≈ {kcal(preview)} kcal</p>}
        </div>
      )}

      <Button type="submit" disabled={!selected || !(qty > 0) || addLog.isPending}>
        {addLog.isPending ? "Adding…" : "Add to diary"}
      </Button>
    </form>
  );
}

function RecipeAdder({ date, initialMeal, onDone }: { date: string; initialMeal: MealType; onDone: (m: string) => void }) {
  const recipes = useRecipes();
  const [meal, setMeal] = useState<MealType>(initialMeal);

  if (recipes.isLoading) return <p className="text-sm text-ink-soft">Loading recipes…</p>;
  if (!recipes.data?.length) {
    return <p className="rounded-sm border border-dashed border-line px-3 py-4 text-center text-sm text-ink-soft">No recipes yet. Build one on the Recipes page.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <Field label="Meal">
        <Select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} className="w-48">
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABELS[m]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="divide-y divide-line rounded-sm border border-line">
        {recipes.data.map((recipe) => (
          <RecipeRow key={recipe.id} recipe={recipe} date={date} meal={meal} onDone={onDone} />
        ))}
      </div>
    </div>
  );
}

function RecipeRow({ recipe, date, meal, onDone }: { recipe: Recipe; date: string; meal: MealType; onDone: (m: string) => void }) {
  const [servings, setServings] = useState("1");
  const [error, setError] = useState("");
  const log = useLogRecipe(recipe.id);

  function add() {
    const value = Number(servings);
    if (!(value > 0)) return;
    setError("");
    log.mutate(
      { servingsConsumed: value, meal, loggedAt: loggedAtFor(date), loggedDate: date },
      {
        onSuccess: () => onDone(`Added ${recipe.name} to ${MEAL_LABELS[meal].toLowerCase()}.`),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add that recipe")
      }
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{recipe.name}</span>
      {error && <span className="text-xs text-alert">{error}</span>}
      <Input type="number" min="0.1" step="0.1" value={servings} onChange={(e) => setServings(e.target.value)} className="w-20" aria-label={`Servings of ${recipe.name}`} />
      <span className="text-xs text-ink-soft">servings</span>
      <Button type="button" onClick={add} disabled={log.isPending} className="px-3 py-1.5">
        {log.isPending ? "Adding…" : "Add"}
      </Button>
    </div>
  );
}
