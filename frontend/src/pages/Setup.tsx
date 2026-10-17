import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { detectTimezone, todayString } from "../lib/dates";
import { kcal } from "../lib/format";
import { useCompleteSetup, usePreviewGoals, useProfile, useSetManualGoal, useWeights, type SetupInput } from "../lib/queries";
import { useToast } from "../lib/toast";
import type { ActivityLevel, GoalType, Sex, UnitPref } from "../lib/types";
import { cmToDisplay, displayToCm, displayToKg, heightUnitLabel, kgToDisplay, weightUnitLabel } from "../lib/units";
import { Button, ErrorText, Field, Input, Panel } from "../components/ui";
import { LogoMark } from "../components/icons";
import { PanelSkeleton } from "../components/Skeleton";

const ACTIVITY: { id: ActivityLevel; label: string; hint: string }[] = [
  { id: "SEDENTARY", label: "Sedentary", hint: "Desk job, little exercise" },
  { id: "LIGHT", label: "Lightly active", hint: "Exercise 1 to 3 days a week" },
  { id: "MODERATE", label: "Moderately active", hint: "Exercise 3 to 5 days a week" },
  { id: "ACTIVE", label: "Very active", hint: "Hard exercise 6 to 7 days a week" },
  { id: "VERY_ACTIVE", label: "Extremely active", hint: "Physical job, or training twice a day" }
];

const GOALS: { id: GoalType; label: string; hint: string }[] = [
  { id: "LOSE", label: "Lose weight", hint: "About 500 kcal a day below maintenance" },
  { id: "MAINTAIN", label: "Maintain", hint: "Stay where you are" },
  { id: "GAIN", label: "Gain weight", hint: "About 500 kcal a day above maintenance" }
];

function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age--;
  return age;
}

function Choice({ selected, onClick, title, hint }: { selected: boolean; onClick: () => void; title: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        selected ? "border-pine bg-pine-tint" : "border-line bg-white hover:bg-paper"
      }`}
    >
      <span className="block text-sm font-semibold text-ink">{title}</span>
      {hint && <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>}
    </button>
  );
}

export function Setup() {
  const navigate = useNavigate();
  const { push } = useToast();
  const profile = useProfile();
  const weights = useWeights();
  const preview = usePreviewGoals();
  const completeSetup = useCompleteSetup();
  const setManual = useSetManualGoal();

  const [step, setStep] = useState(1);
  const [unit, setUnit] = useState<UnitPref>("METRIC");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState<GoalType>("MAINTAIN");
  const [targetWeight, setTargetWeight] = useState("");
  const [activity, setActivity] = useState<ActivityLevel>("MODERATE");
  const [calories, setCalories] = useState("");
  const [error, setError] = useState("");
  const prefilled = useRef(false);
  const ready = !profile.isLoading && !weights.isLoading;

  useEffect(() => {
    if (prefilled.current || !ready || !profile.data) return;
    prefilled.current = true;
    const p = profile.data;
    const u = p.unitPref;
    setUnit(u);
    setName(p.displayName ?? "");
    setDob(p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "");
    setSex(p.sexForCalc ?? "");
    if (p.heightCm) setHeight(String(cmToDisplay(Number(p.heightCm), u)));
    setGoal(p.goal);
    setActivity(p.activityLevel);
    if (p.targetWeightKg) setTargetWeight(String(kgToDisplay(Number(p.targetWeightKg), u)));
    const latest = weights.data?.[0];
    if (latest) setWeight(String(kgToDisplay(Number(latest.weightKg), u)));
  }, [ready, profile.data, weights.data]);

  function switchUnit(next: UnitPref) {
    if (next === unit) return;
    const conv = (value: string, toDisplay: (n: number) => number, fromDisplay: (n: number) => number) =>
      value ? String(toDisplay(fromDisplay(Number(value)))) : value;
    setHeight(conv(height, (cm) => cmToDisplay(cm, next), (v) => displayToCm(v, unit)));
    setWeight(conv(weight, (kg) => kgToDisplay(kg, next), (v) => displayToKg(v, unit)));
    setTargetWeight(conv(targetWeight, (kg) => kgToDisplay(kg, next), (v) => displayToKg(v, unit)));
    setUnit(next);
  }

  const age = ageFrom(dob);
  const step1Problem =
    !dob ? "Enter your date of birth." : age === null || age < 13 ? "You need to be 13 or older to use the calculator." : age > 120 ? "Check your date of birth." : !sex ? "Choose the option the calorie formula should use." : !height ? "Enter your height." : "";
  const step2Problem = !weight ? "Enter your current weight." : "";

  function buildInput(): SetupInput {
    return {
      displayName: name.trim() || null,
      dateOfBirth: dob,
      sexForCalc: sex as Sex,
      heightCm: displayToCm(Number(height), unit),
      weightKg: displayToKg(Number(weight), unit),
      activityLevel: activity,
      goal,
      targetWeightKg: targetWeight ? displayToKg(Number(targetWeight), unit) : null,
      unitPref: unit,
      timezone: detectTimezone()
    };
  }

  function next() {
    setError("");
    if (step === 1 && step1Problem) return setError(step1Problem);
    if (step === 2) {
      if (step2Problem) return setError(step2Problem);
      preview.mutate(buildInput(), {
        onSuccess: (result) => {
          setCalories(String(Math.round(result.calorieTarget)));
          setStep(3);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't calculate that. Check your details.")
      });
      return;
    }
    setStep((s) => s + 1);
  }

  async function finish() {
    if (!preview.data) return;
    setError("");
    const chosen = Math.round(Number(calories));
    if (!chosen || chosen < 800 || chosen > 10000) return setError("Enter a daily calorie target between 800 and 10,000.");
    try {
      await completeSetup.mutateAsync(buildInput());
      if (chosen !== Math.round(preview.data.calorieTarget)) await setManual.mutateAsync({ calorieTarget: chosen });
      push("success", "You're all set. Your target is ready.");
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong saving your setup.");
    }
  }

  if (!ready) return <div className="mx-auto max-w-xl"><PanelSkeleton /></div>;

  const busy = preview.isPending || completeSetup.isPending || setManual.isPending;
  const result = preview.data;
  const chosenCalories = Number(calories);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark size={28} />
          <span className="font-display text-lg font-semibold text-pine-dark">Set up your target</span>
        </div>
        <Link to="/" className="text-sm font-medium text-ink-soft hover:text-ink">
          Skip for now
        </Link>
      </div>

      <div className="mb-6 flex gap-2" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-pine" : "bg-line"}`} />
        ))}
      </div>

      <Panel>
        <ErrorText>{error}</ErrorText>

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-display text-xl font-semibold text-ink">About you</h1>
              <p className="mt-1 text-sm text-ink-soft">We use this to estimate how many calories your body uses each day.</p>
            </div>
            <Field label="What should we call you? (optional)">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-soft">Units</p>
              <div className="grid grid-cols-2 gap-3">
                <Choice selected={unit === "METRIC"} onClick={() => switchUnit("METRIC")} title="Metric" hint="kg, cm" />
                <Choice selected={unit === "IMPERIAL"} onClick={() => switchUnit("IMPERIAL")} title="Imperial" hint="lb, in" />
              </div>
            </div>
            <Field label="Date of birth">
              <Input type="date" value={dob} max={todayString()} onChange={(e) => setDob(e.target.value)} autoComplete="bday" />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-soft">Sex used for the calorie formula</p>
              <div className="grid grid-cols-2 gap-3">
                <Choice selected={sex === "FEMALE"} onClick={() => setSex("FEMALE")} title="Female" />
                <Choice selected={sex === "MALE"} onClick={() => setSex("MALE")} title="Male" />
              </div>
              <p className="mt-1.5 text-xs text-ink-soft">The standard formula has two variants. Pick the one that fits your body best.</p>
            </div>
            <Field label={`Height (${heightUnitLabel(unit)})`}>
              <Input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className="w-40" />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-display text-xl font-semibold text-ink">Your goal</h1>
              <p className="mt-1 text-sm text-ink-soft">This sets how far above or below your daily needs the target lands.</p>
            </div>
            <Field label={`Current weight (${weightUnitLabel(unit)})`}>
              <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-40" />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-soft">What do you want to do?</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {GOALS.map((g) => (
                  <Choice key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)} title={g.label} hint={g.hint} />
                ))}
              </div>
            </div>
            {goal !== "MAINTAIN" && (
              <Field label={`Target weight (${weightUnitLabel(unit)}), optional`}>
                <Input type="number" step="0.1" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} className="w-40" />
              </Field>
            )}
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-soft">How active are you?</p>
              <div className="grid gap-2">
                {ACTIVITY.map((a) => (
                  <Choice key={a.id} selected={activity === a.id} onClick={() => setActivity(a.id)} title={a.label} hint={a.hint} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-display text-xl font-semibold text-ink">Your daily target</h1>
              <p className="mt-1 text-sm text-ink-soft">
                Estimated from the Mifflin-St Jeor formula. Real needs vary by around 10 to 15%, so treat this as a starting point and adjust if your results say otherwise.
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-pine-dark to-pine p-5 text-white">
              <p className="text-sm text-white/70">Calories per day</p>
              <div className="mt-1 flex items-baseline gap-2">
                <Input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  aria-label="Daily calorie target"
                  className="w-36 border-white/30 bg-white/10 font-display text-3xl font-semibold text-white"
                />
                <span className="text-sm text-white/70">kcal</span>
              </div>
              <p className="mt-2 text-xs text-white/65">You can change this number. We suggested {kcal(result.calorieTarget)}.</p>
            </div>
            {chosenCalories > 0 && chosenCalories < 1200 && (
              <p className="rounded-lg bg-gold-tint px-3 py-2 text-sm text-ink">
                Eating under 1,200 kcal a day isn't generally recommended without a doctor or dietitian guiding you.
              </p>
            )}
            <dl className="grid grid-cols-3 gap-3 text-center">
              {[
                ["Protein", result.proteinG],
                ["Carbs", result.carbG],
                ["Fat", result.fatG]
              ].map(([label, grams]) => (
                <div key={label as string} className="rounded-lg bg-paper px-3 py-3">
                  <dt className="text-xs text-ink-soft">{label}</dt>
                  <dd className="font-display text-lg font-semibold text-ink">{Math.round(grams as number)} g</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-ink-soft">
              Resting burn (BMR) about {kcal(result.bmr)} kcal. With your activity, about {kcal(result.tdee)} kcal a day. Macros use a 30/40/30 split of whatever target you choose. You can set exact grams later in Settings.
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => { setError(""); setStep(step - 1); }} disabled={busy}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button onClick={next} disabled={busy}>
              {preview.isPending ? "Calculating…" : "Continue"}
            </Button>
          ) : (
            <Button onClick={finish} disabled={busy}>
              {busy ? "Saving…" : "Use this target"}
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}
