import { useState } from "react";
import { ApiError } from "../../lib/api";
import { formatAmount, kcal, unitLabel } from "../../lib/format";
import { useUpdateEntry } from "../../lib/queries";
import { useToast } from "../../lib/toast";
import type { DiaryEntry } from "../../lib/types";
import { Badge, Input } from "../ui";

export function EntryRow({ entry, onRemove }: { entry: DiaryEntry; onRemove: () => void }) {
  const { push } = useToast();
  const update = useUpdateEntry();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(entry.amount));

  function save() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    update.mutate(
      { entry, amount: value },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => push("error", err instanceof ApiError ? err.message : "Could not update that entry")
      }
    );
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{entry.name}</p>
        <Input
          type="number"
          step="0.1"
          min="0.1"
          autoFocus
          aria-label={`Amount in ${unitLabel(entry.unit)}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-24"
        />
        <span className="text-xs text-ink-soft">{unitLabel(entry.unit)}</span>
        <button onClick={save} disabled={update.isPending} className="text-xs font-medium text-pine hover:underline">
          {update.isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setAmount(String(entry.amount));
          }}
          className="text-xs font-medium text-ink-soft hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
          <span className="truncate">{entry.name}</span>
          {entry.kind === "RECIPE" && <Badge>Recipe</Badge>}
          {entry.source === "AI_ESTIMATED" && <Badge tone="warn">AI estimate</Badge>}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {formatAmount(entry.amount, entry.unit)} · P {Math.round(entry.proteinG)} · C {Math.round(entry.carbG)} · F{" "}
          {Math.round(entry.fatG)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-medium text-ink">{kcal(entry.calories)} kcal</span>
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
