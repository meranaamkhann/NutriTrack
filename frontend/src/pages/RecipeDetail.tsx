import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loggedAtFor, todayString } from "../lib/dates";
import { ApiError } from "../lib/api";
import { useDeleteRecipe, useLogRecipe, useRecipe, useUpdateRecipe } from "../lib/queries";
import type { Food, MealType, RecipeDetail as RecipeDetailData } from "../lib/types";
import { Button, ErrorText, Field, PageHeader, Panel, Select, Input } from "../components/ui";
import { PanelSkeleton } from "../components/Skeleton";
import { useToast } from "../lib/toast";

const MEALS: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export function RecipeDetail() {
  const { push } = useToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [servingsConsumed, setServingsConsumed] = useState("1");
  const [meal, setMeal] = useState<MealType>("LUNCH");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const recipeQuery = useRecipe(id);
  const logRecipe = useLogRecipe(id ?? "");
  const deleteRecipe = useDeleteRecipe();

  function logIt(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    logRecipe.mutate(
      { servingsConsumed: Number(servingsConsumed), meal, loggedAt: loggedAtFor(todayString()), loggedDate: todayString() },
      {
        onSuccess: () => push("success", "Added to today's diary."),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not log recipe")
      }
    );
  }

  function removeRecipe() {
    if (!id) return;
    deleteRecipe.mutate(id, { onSuccess: () => navigate("/recipes") });
  }

  if (recipeQuery.isLoading || !recipeQuery.data) return <PanelSkeleton />;
  const detail = recipeQuery.data;

  if (editing) {
    return <EditRecipe id={id ?? ""} detail={detail} onDone={() => setEditing(false)} />;
  }

  return (
    <div>
      <PageHeader title={detail.recipe.name} subtitle={`${Number(detail.recipe.servings)} servings total`} />

      <Panel className="mb-6">
        <h2 className="mb-3 text-base font-extrabold text-ink">Per serving</h2>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="font-display text-xl font-semibold text-ink">{Math.round(detail.perServing.calories)}</p>
            <p className="text-xs text-ink-soft">kcal</p>
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-ink">{Math.round(detail.perServing.proteinG)}g</p>
            <p className="text-xs text-ink-soft">protein</p>
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-ink">{Math.round(detail.perServing.carbG)}g</p>
            <p className="text-xs text-ink-soft">carbs</p>
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-ink">{Math.round(detail.perServing.fatG)}g</p>
            <p className="text-xs text-ink-soft">fat</p>
          </div>
        </div>
      </Panel>

      <Panel className="mb-6">
        <h2 className="mb-3 text-base font-extrabold text-ink">Ingredients</h2>
        <ul className="flex flex-col gap-2 text-sm text-ink">
          {detail.ingredients.map((ing, i) => (
            <li key={i} className="flex justify-between">
              <span>{ing.food.name}</span>
              <span className="text-ink-soft">
                {Number(ing.ingredient.quantity)}
                {ing.food.servingUnit.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="mb-6">
        <form onSubmit={logIt} className="flex flex-col gap-4">
          <h2 className="text-base font-extrabold text-ink">Log this recipe</h2>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-4">
            <Field label="Servings eaten">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={servingsConsumed}
                onChange={(e) => setServingsConsumed(e.target.value)}
              />
            </Field>
            <Field label="Meal">
              <Select value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
                {MEALS.map((m) => (
                  <option key={m} value={m}>
                    {m[0] + m.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" disabled={logRecipe.isPending}>
            {logRecipe.isPending ? "Logging…" : "Add to today's diary"}
          </Button>
          <p className="text-xs text-ink-soft">
            Need another day? Use <Link to="/" className="font-bold text-ink underline underline-offset-4">the Diary</Link>, pick the day, and add it from the Recipes tab.
          </p>
        </form>
      </Panel>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit recipe
        </Button>
        <Button variant="danger" onClick={removeRecipe} disabled={deleteRecipe.isPending}>
          {deleteRecipe.isPending ? "Deleting…" : "Delete recipe"}
        </Button>
      </div>
    </div>
  );
}

interface EditRow {
  food: Food;
  quantity: string;
}

// Edits name, servings and ingredient amounts. Entries already in your diary
// keep the nutrition they were logged with; only future logs use the new recipe.
function EditRecipe({ id, detail, onDone }: { id: string; detail: RecipeDetailData; onDone: () => void }) {
  const { push } = useToast();
  const updateRecipe = useUpdateRecipe(id);
  const [name, setName] = useState(detail.recipe.name);
  const [servings, setServings] = useState(String(Number(detail.recipe.servings)));
  const [rows, setRows] = useState<EditRow[]>(
    detail.ingredients.map((i) => ({ food: i.food, quantity: String(Number(i.ingredient.quantity)) }))
  );
  const [error, setError] = useState("");

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (rows.length === 0) return setError("A recipe needs at least one ingredient.");
    setError("");
    updateRecipe.mutate(
      { name, servings: Number(servings), ingredients: rows.map((r) => ({ foodId: r.food.id, quantity: Number(r.quantity) })) },
      {
        onSuccess: () => {
          push("success", "Recipe updated.");
          onDone();
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not update recipe")
      }
    );
  }

  return (
    <div>
      <PageHeader title="Edit recipe" subtitle="Past diary entries keep the nutrition they were logged with." />
      <Panel>
        <form onSubmit={save} className="flex flex-col gap-4">
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-4">
            <Field label="Name">
              <Input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Servings">
              <Input required type="number" min="0.1" step="0.1" value={servings} onChange={(e) => setServings(e.target.value)} />
            </Field>
          </div>
          <ul className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <li key={row.food.id + i} className="flex items-center gap-3 text-sm text-ink">
                <span className="flex-1">{row.food.name}</span>
                <Input
                  aria-label={`Quantity of ${row.food.name}`}
                  className="w-28"
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={row.quantity}
                  onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)))}
                />
                <span className="w-12 text-ink-soft">{row.food.servingUnit.toLowerCase()}</span>
                <Button type="button" variant="secondary" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <Button type="submit" disabled={updateRecipe.isPending}>
              {updateRecipe.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="secondary" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
