import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { MealType, RecipeDetail as RecipeDetailType } from "../lib/types";
import { Button, ErrorText, Field, PageHeader, Panel, Select, Input } from "../components/ui";

const MEALS: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<RecipeDetailType | null>(null);
  const [servingsConsumed, setServingsConsumed] = useState("1");
  const [meal, setMeal] = useState<MealType>("LUNCH");
  const [error, setError] = useState("");
  const [logging, setLogging] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!id) return;
    api.get<RecipeDetailType>(`/recipes/${id}`).then(setDetail);
  }, [id]);

  async function logIt(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError("");
    setLogging(true);
    try {
      await api.post(`/recipes/${id}/log`, {
        servingsConsumed: Number(servingsConsumed),
        meal,
        loggedAt: new Date().toISOString()
      });
      setNotice("Logged to today.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log recipe");
    } finally {
      setLogging(false);
    }
  }

  async function deleteRecipe() {
    if (!id) return;
    await api.delete(`/recipes/${id}`);
    navigate("/recipes");
  }

  if (!detail) return <p className="text-sm text-ink-soft">Loading…</p>;

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
          {notice && <p className="rounded-md bg-pine-tint px-3 py-2 text-sm text-pine-dark">{notice}</p>}
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
          <Button type="submit" disabled={logging}>
            {logging ? "Logging…" : "Log to today"}
          </Button>
        </form>
      </Panel>

      <Button variant="danger" onClick={deleteRecipe}>
        Delete recipe
      </Button>
    </div>
  );
}
