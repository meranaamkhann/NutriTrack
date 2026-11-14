import type { DiaryEntry, MealType } from "../../lib/types";
import { kcal } from "../../lib/format";
import { Icon } from "../icons";
import { EntryRow } from "./EntryRow";
import { MEAL_LABELS } from "./meals";

export function MealSection({
  meal,
  entries,
  onAdd,
  onRemove
}: {
  meal: MealType;
  entries: DiaryEntry[];
  onAdd: (meal: MealType) => void;
  onRemove: (entry: DiaryEntry) => void;
}) {
  const subtotal = entries.reduce((sum, e) => sum + e.calories, 0);
  return (
    <section className="rounded-sm border border-line border-t-4 border-t-ink bg-white">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <h3 className="font-display text-lg font-extrabold">{MEAL_LABELS[meal]}</h3>
        <div className="flex items-center gap-3">
          <p className={`text-sm ${entries.length === 0 ? "text-ink-soft" : "font-bold"}`}>
            {entries.length === 0 ? "Nothing yet" : `${kcal(subtotal)} kcal`}
          </p>
          <button
            onClick={() => onAdd(meal)}
            aria-label={`Add to ${MEAL_LABELS[meal]}`}
            className="flex h-9 w-9 items-center justify-center border-2 border-ink hover:bg-mark"
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
      </header>
      {entries.length > 0 && (
        <div className="divide-y divide-line border-t border-line">
          {entries.map((entry) => (
            <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} onRemove={() => onRemove(entry)} />
          ))}
        </div>
      )}
    </section>
  );
}
