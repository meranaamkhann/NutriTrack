import { addDays, formatDayLabel, formatLongDate, todayString } from "../lib/dates";
import { Icon } from "./icons";

export function DateNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  const today = todayString();
  const isToday = date === today;
  const btn = "flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink-soft hover:bg-paper disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button className={btn} onClick={() => onChange(addDays(date, -1))} aria-label="Previous day">
        <Icon name="chevron-left" size={18} />
      </button>
      <label className="relative flex h-9 min-w-36 cursor-pointer items-center justify-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-paper">
        <span>{formatDayLabel(date)}</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`Pick a day. Showing ${formatLongDate(date)}`}
        />
      </label>
      <button className={btn} onClick={() => onChange(addDays(date, 1))} disabled={isToday} aria-label="Next day">
        <Icon name="chevron-right" size={18} />
      </button>
      {!isToday && (
        <button onClick={() => onChange(today)} className="text-sm font-medium text-pine hover:underline">
          Back to today
        </button>
      )}
    </div>
  );
}