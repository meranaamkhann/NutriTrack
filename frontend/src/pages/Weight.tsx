import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Weight as WeightEntry } from "../lib/types";
import { Button, EmptyState, ErrorText, Field, Input, PageHeader, Panel } from "../components/ui";

export function Weight() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weightKg, setWeightKg] = useState("");
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setEntries(await api.get<WeightEntry[]>("/weights", { limit: 60 }));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/weights", { weightKg: Number(weightKg), recordedAt });
      setWeightKg("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save weight");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/weights/${id}`);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const trend = entries.length >= 2 ? Number(entries[0].weightKg) - Number(entries[entries.length - 1].weightKg) : null;

  return (
    <div>
      <PageHeader title="Weight" subtitle="One entry per day. Editing your current weight never changes past entries." />

      <Panel className="mb-6">
        <form onSubmit={submit} className="flex items-end gap-4">
          <Field label="Weight (kg)">
            <Input
              type="number"
              step="0.1"
              min="20"
              max="400"
              required
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <Input type="date" required value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} />
          </Field>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Panel>

      {trend !== null && (
        <p className="mb-4 text-sm text-ink-soft">
          {trend === 0 ? "No change" : trend > 0 ? `Up ${trend.toFixed(1)}kg` : `Down ${Math.abs(trend).toFixed(1)}kg`}{" "}
          over this period
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState title="No weight entries yet" body="Log your weight above to start tracking trends." />
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-white">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-ink">{new Date(entry.recordedAt).toLocaleDateString()}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink">{Number(entry.weightKg)} kg</span>
                <button
                  onClick={() => remove(entry.id)}
                  className="text-xs font-medium text-brick hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
