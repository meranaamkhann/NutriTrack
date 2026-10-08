import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/api";
import { useToast } from "../lib/toast";
import { useProfile, useUpsertWeight, useDeleteWeight, useWeights, qk } from "../lib/queries";
import type { Weight as WeightEntry } from "../lib/types";
import { kgToDisplay, displayToKg, weightUnitLabel } from "../lib/units";
import { EmptyState, ErrorText, Field, Input, PageHeader, Panel, Button } from "../components/ui";
import { ListSkeleton } from "../components/Skeleton";

export function Weight() {
  const { push } = useToast();
  const qc = useQueryClient();
  const profileQuery = useProfile();
  const unitPref = profileQuery.data?.unitPref ?? "METRIC";
  const unitLabel = weightUnitLabel(unitPref);

  const weightsQuery = useWeights();
  const entries = weightsQuery.data ?? [];
  const upsertWeight = useUpsertWeight();
  const deleteWeight = useDeleteWeight();

  const [weightInput, setWeightInput] = useState("");
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    upsertWeight.mutate(
      { weightKg: displayToKg(Number(weightInput), unitPref), recordedAt },
      {
        onSuccess: () => {
          setWeightInput("");
          push("success", "Weight saved.");
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save weight")
      }
    );
  }

  function remove(id: string) {
    const previous = qc.getQueryData<WeightEntry[]>(qk.weights);
    qc.setQueryData<WeightEntry[]>(qk.weights, (old) => old?.filter((e) => e.id !== id));
    deleteWeight.mutate(id, {
      onError: (err) => {
        qc.setQueryData(qk.weights, previous);
        push("error", err instanceof ApiError ? err.message : "Could not remove that entry");
      }
    });
  }

  const trend =
    entries.length >= 2
      ? kgToDisplay(Number(entries[0].weightKg), unitPref) - kgToDisplay(Number(entries[entries.length - 1].weightKg), unitPref)
      : null;

  return (
    <div>
      <PageHeader title="Weight" subtitle="One entry per day. Editing your current weight never changes past entries." />

      <Panel className="mb-6">
        <form onSubmit={submit} className="flex items-end gap-4">
          <Field label={`Weight (${unitLabel})`}>
            <Input
              type="number"
              step="0.1"
              min={unitPref === "IMPERIAL" ? "44" : "20"}
              max={unitPref === "IMPERIAL" ? "880" : "400"}
              required
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <Input type="date" required value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} />
          </Field>
          <Button type="submit" disabled={upsertWeight.isPending}>
            {upsertWeight.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Panel>

      {trend !== null && (
        <p className="mb-4 text-sm text-ink-soft">
          {trend === 0
            ? "No change"
            : trend > 0
              ? `Up ${trend.toFixed(1)}${unitLabel}`
              : `Down ${Math.abs(trend).toFixed(1)}${unitLabel}`}{" "}
          over this period
        </p>
      )}

      {weightsQuery.isLoading ? (
        <ListSkeleton rows={5} />
      ) : entries.length === 0 ? (
        <EmptyState title="No weight entries yet" body="Log your weight above to start tracking trends." />
      ) : (
        <div className="divide-y divide-line rounded-lg border border-line bg-white">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-ink">{new Date(entry.recordedAt).toLocaleDateString()}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink">
                  {kgToDisplay(Number(entry.weightKg), unitPref)} {unitLabel}
                </span>
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
