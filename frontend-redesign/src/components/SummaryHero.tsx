import { Link } from "react-router-dom";
import { kcal } from "../lib/format";
import type { DiaryGoal } from "../lib/types";
import { Badge } from "./ui";

interface Totals {
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

function Bar({ label, value, target, kind }: { label: string; value: number; target?: number | null; kind: "bar-protein" | "bar-carb" | "bar-fat" }) {
  const pct = target ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div
      className="bar-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target ?? undefined}
      aria-valuenow={Math.round(value)}
    >
      <div className={`bar-fill ${kind}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MacroRow({
  label,
  grams,
  target,
  kind
}: {
  label: string;
  grams: number;
  target?: number;
  kind: "bar-protein" | "bar-carb" | "bar-fat";
}) {
  return (
    <div className="border-t border-line py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-bold">{label}</span>
        <span>
          {Math.round(grams)}
          {target ? ` / ${Math.round(target)}` : ""} g
          {target ? <span className="ml-3 inline-block w-10 text-right font-bold">{Math.round((grams / target) * 100)}%</span> : null}
        </span>
      </div>
      <Bar label={`${label} eaten`} value={grams} target={target} kind={kind} />
    </div>
  );
}

export function SummaryHero({ totals, goal }: { totals: Totals; goal: DiaryGoal | null }) {
  const target = goal?.calorieTarget ?? null;
  const remaining = target !== null ? Math.round(target - totals.calories) : null;
  const over = remaining !== null && remaining < 0;
  const calPct = target ? Math.min((totals.calories / target) * 100, 100) : 0;

  return (
    <section className="rounded-sm border border-line border-t-[12px] border-t-ink bg-white px-5 pb-5 pt-4">
      <div className="flex items-end justify-between gap-4 border-b-[6px] border-ink pb-3">
        <div>
          {remaining !== null ? (
            <>
              <span className={`block font-display text-7xl font-black leading-none ${over ? "text-alert" : "text-ink"}`}>{kcal(Math.abs(remaining))}</span>
              <span className="mt-1 block text-sm font-bold">{over ? "kcal over" : "kcal left"}</span>
            </>
          ) : (
            <>
              <span className="block font-display text-7xl font-black leading-none">{kcal(totals.calories)}</span>
              <span className="mt-1 block text-sm font-bold">kcal eaten</span>
            </>
          )}
        </div>
        {target !== null && (
          <dl className="text-right text-sm">
            <dt className="text-ink-soft">Eaten</dt>
            <dd className="mb-2 text-lg font-extrabold">{kcal(totals.calories)}</dd>
            <dt className="text-ink-soft">Daily target</dt>
            <dd className="text-lg font-extrabold">{kcal(target)}</dd>
          </dl>
        )}
      </div>

      {target !== null && (
        <div
          className="bar-track mt-3"
          role="progressbar"
          aria-label="Calories eaten"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.round(totals.calories)}
        >
          <div className={`bar-fill ${over ? "bar-over" : "bar-fat"}`} style={{ width: `${calPct}%` }} />
        </div>
      )}

      <div className="mt-4">
        <MacroRow label="Protein" grams={totals.proteinG} target={goal?.proteinGTarget} kind="bar-protein" />
        <MacroRow label="Carbs" grams={totals.carbG} target={goal?.carbGTarget} kind="bar-carb" />
        <MacroRow label="Fat" grams={totals.fatG} target={goal?.fatGTarget} kind="bar-fat" />
      </div>

      <div className="mt-3 flex items-center gap-3 border-t-[6px] border-ink pt-3 text-sm">
        {goal ? (
          <>
            <Badge tone="neutral">{goal.source === "MANUAL" ? "Your own target" : "Calculated estimate"}</Badge>
            <Link to="/settings?tab=targets" className="font-bold underline underline-offset-4 hover:bg-mark">
              Change
            </Link>
          </>
        ) : (
          <Link to="/setup" className="bg-mark px-4 py-2 text-sm font-bold text-ink hover:brightness-95">
            Set your daily target
          </Link>
        )}
      </div>
    </section>
  );
}
