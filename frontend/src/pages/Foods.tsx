import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Food } from "../lib/types";
import { Button, EmptyState, ErrorText, Field, Input, PageHeader, Panel, Select } from "../components/ui";
import { ListSkeleton } from "../components/Skeleton";
import { useToast } from "../lib/toast";

const UNITS = ["G", "ML", "PIECE", "CUP", "TBSP", "TSP", "OZ"];

export function Foods() {
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get<Food[]>("/foods", { q: query || undefined, limit: 50 });
    setFoods(res);
    setLoading(false);
  }

  useEffect(() => {
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div>
      <PageHeader title="Foods" subtitle="Your custom foods and the shared food database." />
      <div className="mb-4 flex gap-3">
        <Input placeholder="Search foods…" value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1" />
        <Button onClick={() => setShowCreate((s) => !s)} variant="secondary">
          {showCreate ? "Close" : "+ New food"}
        </Button>
      </div>

      {showCreate && (
        <div className="mb-6">
          <CreateFoodForm
            onCreated={() => {
              setShowCreate(false);
              push("success", "Food created.");
              load();
            }}
          />
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : foods.length === 0 ? (
        <EmptyState title="No foods found" body="Try a different search, or create your own food." />
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-white">
          {foods.map((food) => (
            <div key={food.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">{food.name}</p>
                <p className="text-xs text-ink-soft">
                  {Number(food.servingSize)}
                  {food.servingUnit.toLowerCase()} · P{Number(food.proteinG)}g · C{Number(food.carbG)}g · F
                  {Number(food.fatG)}g
                </p>
              </div>
              <span className="text-sm text-ink">{Number(food.calories)} kcal</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateFoodForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    servingSize: "100",
    servingUnit: "G",
    calories: "",
    proteinG: "0",
    carbG: "0",
    fatG: "0"
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/foods", {
        name: form.name,
        servingSize: Number(form.servingSize),
        servingUnit: form.servingUnit,
        calories: Number(form.calories),
        proteinG: Number(form.proteinG),
        carbG: Number(form.carbG),
        fatG: Number(form.fatG)
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create food");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorText>{error}</ErrorText>
        <Field label="Name">
          <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="flex gap-4">
          <Field label="Serving size">
            <Input
              type="number"
              step="0.1"
              min="0.1"
              required
              value={form.servingSize}
              onChange={(e) => set("servingSize", e.target.value)}
            />
          </Field>
          <Field label="Unit">
            <Select value={form.servingUnit} onChange={(e) => set("servingUnit", e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u.toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Calories">
            <Input type="number" step="1" min="0" required value={form.calories} onChange={(e) => set("calories", e.target.value)} />
          </Field>
          <Field label="Protein (g)">
            <Input type="number" step="0.1" min="0" value={form.proteinG} onChange={(e) => set("proteinG", e.target.value)} />
          </Field>
          <Field label="Carbs (g)">
            <Input type="number" step="0.1" min="0" value={form.carbG} onChange={(e) => set("carbG", e.target.value)} />
          </Field>
          <Field label="Fat (g)">
            <Input type="number" step="0.1" min="0" value={form.fatG} onChange={(e) => set("fatG", e.target.value)} />
          </Field>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create food"}
        </Button>
      </form>
    </Panel>
  );
}
