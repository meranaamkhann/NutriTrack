import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useCreateRecipe, useFoodSearch, useRecipes } from "../lib/queries";
import type { Food } from "../lib/types";
import { Button, EmptyState, ErrorText, Field, Input, PageHeader, Panel } from "../components/ui";
import { ListSkeleton } from "../components/Skeleton";
import { useToast } from "../lib/toast";

export function Recipes() {
  const { push } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const recipesQuery = useRecipes();
  const recipes = recipesQuery.data ?? [];

  return (
    <div>
      <PageHeader title="Recipes" subtitle="Combine foods into a reusable recipe." />
      <div className="mb-4">
        <Button onClick={() => setShowCreate((s) => !s)} variant="secondary">
          {showCreate ? "Close" : "+ New recipe"}
        </Button>
      </div>

      {showCreate && (
        <div className="mb-6">
          <CreateRecipeForm
            onCreated={() => {
              setShowCreate(false);
              push("success", "Recipe created.");
            }}
          />
        </div>
      )}

      {recipesQuery.isLoading ? (
        <ListSkeleton rows={4} />
      ) : recipes.length === 0 ? (
        <EmptyState title="No recipes yet" body="Create one from foods you've already added." />
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-white">
          {recipes.map((r) => (
            <Link
              key={r.id}
              to={`/recipes/${r.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-paper"
            >
              <span className="text-sm font-medium text-ink">{r.name}</span>
              <span className="text-xs text-ink-soft">{Number(r.servings)} servings</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface DraftIngredient {
  food: Food;
  quantity: string;
}

function CreateRecipeForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [servings, setServings] = useState("4");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [error, setError] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const searchQuery = useFoodSearch(debouncedQuery);
  const createRecipe = useCreateRecipe();
  const results = debouncedQuery ? searchQuery.data ?? [] : [];

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(value), 250);
  }

  function addIngredient(food: Food) {
    setIngredients((prev) => [...prev, { food, quantity: String(Number(food.servingSize)) }]);
    setQuery("");
    setDebouncedQuery("");
  }

  function setIngredientQty(index: number, quantity: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, quantity } : ing)));
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ingredients.length === 0) {
      setError("Add at least one ingredient");
      return;
    }
    setError("");
    createRecipe.mutate(
      {
        name,
        servings: Number(servings),
        ingredients: ingredients.map((ing) => ({ foodId: ing.food.id, quantity: Number(ing.quantity) }))
      },
      {
        onSuccess: () => onCreated(),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create recipe")
      }
    );
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-4">
          <Field label="Recipe name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Servings">
            <Input
              type="number"
              min="1"
              step="1"
              required
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Add ingredient">
          <Input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="search your foods" />
        </Field>
        {results.length > 0 && (
          <div className="divide-y divide-line rounded-md border border-line">
            {results.map((food) => (
              <button
                type="button"
                key={food.id}
                onClick={() => addIngredient(food)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-paper"
              >
                <span>{food.name}</span>
                <span className="text-ink-soft">{Number(food.calories)} kcal</span>
              </button>
            ))}
          </div>
        )}

        {ingredients.length > 0 && (
          <div className="flex flex-col gap-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-ink">{ing.food.name}</span>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="w-24"
                  value={ing.quantity}
                  onChange={(e) => setIngredientQty(i, e.target.value)}
                />
                <span className="text-xs text-ink-soft">{ing.food.servingUnit.toLowerCase()}</span>
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  className="text-xs font-medium text-brick hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <Button type="submit" disabled={createRecipe.isPending}>
          {createRecipe.isPending ? "Creating…" : "Create recipe"}
        </Button>
      </form>
    </Panel>
  );
}
