import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { DailyProgress } from "../lib/types";
import { EmptyState, Field, Input, PageHeader, Panel } from "../components/ui";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function Progress() {
  const [from, setFrom] = useState(daysAgo(13));
  const [to, setTo] = useState(daysAgo(0));
  const [data, setData] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<DailyProgress>("/progress", { from, to })
      .then(setData)
      .finally(() => setLoading(false));
  }, [from, to]);

  const maxCalories = data ? Math.max(1, ...data.days.map((d) => d.totals.calories), ...data.days.map((d) => d.calorieTarget ?? 0)) : 1;

  return (
    <div>
      <PageHeader title="Progress" subtitle="Calories over time against your target." />

      <div className="mb-6 flex gap-4">
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : !data || data.days.length === 0 ? (
        <EmptyState title="No data in this range" body="Log some food in this date range to see progress here." />
      ) : (
        <Panel>
          <div className="flex h-48 items-end gap-2">
            {data.days.map((day) => {
              const heightPct = (day.totals.calories / maxCalories) * 100;
              const over = day.calorieTarget !== null && day.totals.calories > day.calorieTarget;
              const targetPct = day.calorieTarget ? (day.calorieTarget / maxCalories) * 100 : null;
              return (
                <div key={day.date} className="relative flex flex-1 flex-col items-center justify-end">
                  {targetPct !== null && (
                    <div
                      className="absolute w-full border-t-2 border-dashed border-ink-soft/40"
                      style={{ bottom: `${targetPct}%` }}
                    />
                  )}
                  <div
                    className={`w-full rounded-t-sm ${over ? "bg-brick" : "bg-gold"}`}
                    style={{ height: `${heightPct}%`, minHeight: day.totals.calories > 0 ? "4px" : "0" }}
                    title={`${Math.round(day.totals.calories)} kcal`}
                  />
                  <span className="mt-2 text-[10px] text-ink-soft">
                    {new Date(day.date).toLocaleDateString(undefined, { day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-ink-soft">Dashed line marks that day's calorie target, where one was set.</p>
        </Panel>
      )}
    </div>
  );
}
