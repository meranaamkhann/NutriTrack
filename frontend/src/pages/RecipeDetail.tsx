import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useDeleteRecipe, useLogRecipe, useRecipe } from "../lib/queries";
import type { MealType } from "../lib/types";
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

  const recipeQuery = useRecipe(id);
  const logRecipe = useLogRecipe(id ?? "");
  const deleteRecipe = useDeleteRecipe();

  function logIt(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    logRecipe.mutate(
      { servingsConsumed: Number(servingsConsumed), meal, loggedAt: new Date().toISOString() },
      {
        onSuccess: () => push("success", "Logged to today."),
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

  return (
    <div>
      <PageHeader title={detail.recipe.name} subtitle={`${Number(detail.recipe.servings)} servings total`} />

      <Panel className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Per serving</h2>
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Ingredients</h2>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Log this recipe</h2>
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
            {logRecipe.isPending ? "Logging…" : "Log to today"}
          </Button>
        </form>
      </Panel>

      <Button variant="danger" onClick={removeRecipe} disabled={deleteRecipe.isPending}>
        {deleteRecipe.isPending ? "Deleting…" : "Delete recipe"}
      </Button>
    </div>
  );
}
