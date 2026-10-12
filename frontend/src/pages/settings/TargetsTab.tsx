import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { kcal } from "../../lib/format";
import { useCurrentGoal, useGoalHistory, useRecalculateGoals, useSetManualGoal } from "../../lib/queries";
import { useToast } from "../../lib/toast";
import { Badge, Button, ErrorText, Field, Input, Panel } from "../../components/ui";
import { PanelSkeleton } from "../../components/Skeleton";

export function TargetsTab() {
  const { push } = useToast();
  const current = useCurrentGoal();
  const history = useGoalHistory();
  const recalc = useRecalculateGoals();
  const manual = useSetManualGoal();

  const [calories, setCalories] = useState("");
  const [custom, setCustom] = useState(false);
  const [macros, setMacros] = useState({ proteinG: "", carbG: "", fatG: "" });
  const [error, setError] = useState("");

  const goal = current.data;
  const cal = Number(calories);
  const macroKcal = Number(macros.proteinG) * 4 + Number(macros.carbG) * 4 + Number(macros.fatG) * 9;
  const macroMismatch = custom && cal > 0 && macroKcal > 0 && Math.abs(macroKcal - cal) / cal > 0.1;

  function recalculate() {
    setError("");
    recalc.mutate(undefined, {
      onSuccess: () => push("success", "Recalculated from your latest profile and weight."),
      onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't recalculate.")
    });
  }

  function saveManual(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    manual.mutate(
      {
        calorieTarget: cal,
        ...(custom ? { proteinG: Number(macros.proteinG), carbG: Number(macros.carbG), fatG: Number(macros.fatG) } : {})
      },
      {
        onSuccess: () => {
          push("success", "Your target is saved.");
          setCalories("");
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save that target.")
      }
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ErrorText>{error}</ErrorText>

      {current.isLoading ? (
        <PanelSkeleton />
      ) : (
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Current target</h2>
            {goal && <Badge tone={goal.source === "MANUAL" ? "warn" : "good"}>{goal.source === "MANUAL" ? "Your own number" : "Calculated estimate"}</Badge>}
          </div>
          {goal ? (
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                [kcal(Number(goal.calorieTarget)), "kcal"],
                [`${Math.round(Number(goal.proteinGTarget))} g`, "protein"],
                [`${Math.round(Number(goal.carbGTarget))} g`, "carbs"],
                [`${Math.round(Number(goal.fatGTarget))} g`, "fat"]
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-display text-xl font-semibold text-ink">{value}</p>
                  <p className="text-xs text-ink-soft">{label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">No target yet. Pick one of the options below.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/setup">
              <Button>Guided setup</Button>
            </Link>
            <Button variant="secondary" onClick={recalculate} disabled={recalc.isPending}>
              {recalc.isPending ? "Recalculating…" : "Recalculate from profile & latest weight"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            Calculated targets use the Mifflin-St Jeor formula. They're estimates, not medical advice, and past days keep the target they had.
          </p>
        </Panel>
      )}

      <Panel>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-soft">Set my own target</h2>
        <p className="mb-4 text-sm text-ink-soft">Already know your number from a dietitian or coach? Enter it directly.</p>
        <form onSubmit={saveManual} className="flex flex-col gap-4">
          <Field label="Calories per day">
            <Input type="number" min="800" max="10000" step="10" required value={calories} onChange={(e) => setCalories(e.target.value)} className="w-40" />
          </Field>
          {cal > 0 && cal < 1200 && (
            <p className="rounded-lg bg-gold-tint px-3 py-2 text-sm text-ink">Below about 1,200 kcal a day isn't generally recommended without medical supervision.</p>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} className="h-4 w-4 accent-pine" />
            I want to set my own protein, carb and fat grams
          </label>
          {custom ? (
            <div className="grid grid-cols-3 gap-3">
              {(["proteinG", "carbG", "fatG"] as const).map((key) => (
                <Field key={key} label={key === "proteinG" ? "Protein (g)" : key === "carbG" ? "Carbs (g)" : "Fat (g)"}>
                  <Input type="number" min="0" step="1" required value={macros[key]} onChange={(e) => setMacros((m) => ({ ...m, [key]: e.target.value }))} />
                </Field>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-soft">Macros will be split 30% protein, 40% carbs, 30% fat.</p>
          )}
          {macroMismatch && (
            <p className="rounded-lg bg-gold-tint px-3 py-2 text-sm text-ink">
              Those macros add up to about {kcal(macroKcal)} kcal, which differs from your {kcal(cal)} kcal target.
            </p>
          )}
          <div>
            <Button type="submit" disabled={manual.isPending || !(cal >= 800)}>
              {manual.isPending ? "Saving…" : "Save my target"}
            </Button>
          </div>
        </form>
      </Panel>

      {(history.data?.length ?? 0) > 1 && (
        <Panel>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Target history</h2>
          <ul className="divide-y divide-line">
            {history.data!.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-soft">{new Date(g.effectiveFrom).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-ink">{kcal(Number(g.calorieTarget))} kcal</span>
                  <Badge>{g.source === "MANUAL" ? "Own" : "Calculated"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
