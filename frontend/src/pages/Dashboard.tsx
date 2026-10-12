import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/api";
import { formatLongDate, greeting, todayString } from "../lib/dates";
import { qk, useDeleteEntry, useDiary, useProfile } from "../lib/queries";
import { useToast } from "../lib/toast";
import type { Diary, DiaryEntry, MealType } from "../lib/types";
import { Button, ErrorText } from "../components/ui";
import { DateNav } from "../components/DateNav";
import { SummaryHero } from "../components/SummaryHero";
import { Skeleton } from "../components/Skeleton";
import { AddPanel } from "../components/diary/AddPanel";
import { MealSection } from "../components/diary/MealSection";
import { MEALS, defaultMealForNow } from "../components/diary/meals";

export function Dashboard() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayString());
  const [adding, setAdding] = useState<{ meal: MealType; n: number } | null>(null);

  const diaryQuery = useDiary(date);
  const profile = useProfile();
  const deleteEntry = useDeleteEntry();

  const entries = diaryQuery.data?.entries ?? [];
  const goal = diaryQuery.data?.goal ?? null;
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbG: acc.carbG + e.carbG,
      fatG: acc.fatG + e.fatG
    }),
    { calories: 0, proteinG: 0, carbG: 0, fatG: 0 }
  );

  function openAdd(meal: MealType) {
    setAdding((current) => ({ meal, n: (current?.n ?? 0) + 1 }));
  }

  function removeEntry(entry: DiaryEntry) {
    const key = qk.diary(date);
    const previous = qc.getQueryData<Diary>(key);
    // Remove it from the screen straight away; put it back if the server says no.
    qc.setQueryData<Diary>(key, (old) =>
      old ? { ...old, entries: old.entries.filter((e) => !(e.id === entry.id && e.kind === entry.kind)) } : old
    );
    deleteEntry.mutate(entry, {
      onError: (err) => {
        qc.setQueryData(key, previous);
        push("error", err instanceof ApiError ? err.message : "Could not remove that entry");
      }
    });
  }

  const name = profile.data?.displayName?.trim();
  const isToday = date === todayString();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {isToday ? `${greeting()}${name ? `, ${name}` : ""}` : formatLongDate(date)}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{isToday ? formatLongDate(date) : "Viewing a past day. You can still add or edit entries."}</p>
        </div>
        <DateNav
          date={date}
          onChange={(d) => {
            setDate(d);
            setAdding(null);
          }}
        />
      </div>

      {diaryQuery.isError && <ErrorText>Couldn't load this day. Check your connection and try again.</ErrorText>}

      {diaryQuery.isLoading ? <Skeleton className="h-60 w-full rounded-2xl" /> : <SummaryHero totals={totals} goal={goal} />}

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Diary</h2>
        <div className="flex gap-2">
          <Link to="/quick-add">
            <Button variant="secondary">Quick add</Button>
          </Link>
          <Button onClick={() => openAdd(defaultMealForNow())}>+ Add food</Button>
        </div>
      </div>

      {adding && (
        <AddPanel
          key={adding.n}
          date={date}
          initialMeal={adding.meal}
          onClose={() => setAdding(null)}
          onDone={(message) => {
            setAdding(null);
            push("success", message);
          }}
        />
      )}

      {diaryQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {MEALS.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={entries.filter((e) => e.meal === meal)}
              onAdd={openAdd}
              onRemove={removeEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
