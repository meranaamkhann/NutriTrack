import type { DiaryEntry, MealType } from "../../lib/types";
import { kcal } from "../../lib/format";
import { Icon, type IconName } from "../icons";
import { EntryRow } from "./EntryRow";
import { MEAL_LABELS } from "./meals";

const MEAL_ICONS: Record<MealType, IconName> = {
  BREAKFAST: "sunrise",
  LUNCH: "sun",
  DINNER: "moon",
  SNACK: "apple",
  CUSTOM: "apple"
};

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
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pine-tint text-pine-dark">
            <Icon name={MEAL_ICONS[meal]} size={18} />
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">{MEAL_LABELS[meal]}</h3>
            <p className="text-xs text-ink-soft">{entries.length === 0 ? "Nothing yet" : `${kcal(subtotal)} kcal`}</p>
          </div>
        </div>
        <button
          onClick={() => onAdd(meal)}
          aria-label={`Add to ${MEAL_LABELS[meal]}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-pine hover:bg-pine-tint"
        >
          <Icon name="plus" size={18} />
        </button>
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
