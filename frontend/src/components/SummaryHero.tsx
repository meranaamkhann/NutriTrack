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

const SIZE = 176;
const STROKE = 14;

function Ring({ consumed, target }: { consumed: number; target: number | null }) {
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = target ? Math.min(consumed / target, 1) : 0;
  const over = target !== null && consumed > target;
  const remaining = target !== null ? Math.round(target - consumed) : null;

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90" role="img" aria-label={target ? `${kcal(consumed)} of ${kcal(target)} calories eaten` : `${kcal(consumed)} calories eaten`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth={STROKE} fill="none" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          stroke={over ? "#f08a80" : "#e0b25a"}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {remaining !== null ? (
          <>
            <span className={`font-display text-4xl font-semibold ${over ? "text-[#f8b4ad]" : "text-white"}`}>
              {kcal(Math.abs(remaining))}
            </span>
            <span className="text-xs text-white/70">{over ? "kcal over" : "kcal left"}</span>
          </>
        ) : (
          <>
            <span className="font-display text-4xl font-semibold text-white">{kcal(consumed)}</span>
            <span className="text-xs text-white/70">kcal eaten</span>
          </>
        )}
      </div>
    </div>
  );
}

function MacroRow({ label, grams, target, color }: { label: string; grams: number; target?: number; color: string }) {
  const pct = target ? Math.min((grams / target) * 100, 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="text-white/70">
          {Math.round(grams)}
          {target ? ` / ${Math.round(target)}` : ""} g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, transition: "width 400ms ease" }} />
      </div>
    </div>
  );
}

export function SummaryHero({ totals, goal }: { totals: Totals; goal: DiaryGoal | null }) {
  const target = goal?.calorieTarget ?? null;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine-dark to-pine p-6 text-white">
      <svg className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 text-white opacity-[0.06]" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M20 180C20 90 80 20 190 20c0 100-60 160-170 160z" fill="currentColor" />
      </svg>
      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <Ring consumed={totals.calories} target={target} />
        <div className="w-full flex-1">
          <div className="mb-4 flex items-center justify-between text-sm">
            <div>
              <p className="text-white/65">Eaten</p>
              <p className="font-display text-xl font-semibold">{kcal(totals.calories)}</p>
            </div>
            <div className="text-right">
              <p className="text-white/65">Daily target</p>
              <p className="font-display text-xl font-semibold">{target ? kcal(target) : "Not set"}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <MacroRow label="Protein" grams={totals.proteinG} target={goal?.proteinGTarget} color="#7fd1b0" />
            <MacroRow label="Carbs" grams={totals.carbG} target={goal?.carbGTarget} color="#e0b25a" />
            <MacroRow label="Fat" grams={totals.fatG} target={goal?.fatGTarget} color="#8bb8dd" />
          </div>
          {goal ? (
            <p className="mt-4 flex items-center gap-2 text-xs text-white/65">
              <Badge tone="neutral">{goal.source === "MANUAL" ? "Your own target" : "Calculated estimate"}</Badge>
              <Link to="/settings?tab=targets" className="underline underline-offset-2 hover:text-white">
                Change
              </Link>
            </p>
          ) : (
            <Link
              to="/setup"
              className="mt-4 inline-flex rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pine-dark hover:brightness-105"
            >
              Set your daily target
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}