import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { detectTimezone } from "../../lib/dates";
import { useProfile, useRecalculateGoals, useSaveProfile, type ProfileUpdateInput } from "../../lib/queries";
import { useToast } from "../../lib/toast";
import type { ActivityLevel, GoalType, Profile, Sex, UnitPref } from "../../lib/types";
import { cmToDisplay, displayToCm, displayToKg, heightUnitLabel, kgToDisplay, weightUnitLabel } from "../../lib/units";
import { Button, ErrorText, Field, Input, Panel, Select } from "../../components/ui";
import { PanelSkeleton } from "../../components/Skeleton";

const ACTIVITY: [ActivityLevel, string][] = [
  ["SEDENTARY", "Mostly sitting"],
  ["LIGHT", "Lightly active"],
  ["MODERATE", "Moderately active"],
  ["ACTIVE", "Very active"],
  ["VERY_ACTIVE", "Extremely active"]
];

function timezoneOptions(current: string): string[] {
  const api = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const all = api.supportedValuesOf?.("timeZone") ?? [];
  return Array.from(new Set([current, detectTimezone(), "UTC", ...all]));
}

export function ProfileTab() {
  const { push } = useToast();
  const query = useProfile();
  const save = useSaveProfile();
  const recalc = useRecalculateGoals();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [needsWeight, setNeedsWeight] = useState(false);

  // The form edits a local copy so typing never fights the cached server data.
  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  const zones = useMemo(() => timezoneOptions(draft?.timezone ?? "UTC"), [draft?.timezone]);

  if (query.isLoading || !draft) return <PanelSkeleton />;
  const unit = draft.unitPref;
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  function payload(): ProfileUpdateInput {
    return {
      displayName: draft!.displayName?.trim() || null,
      dateOfBirth: draft!.dateOfBirth ? draft!.dateOfBirth.slice(0, 10) : undefined,
      sexForCalc: draft!.sexForCalc || undefined,
      heightCm: draft!.heightCm ? Number(draft!.heightCm) : undefined,
      activityLevel: draft!.activityLevel,
      goal: draft!.goal,
      timezone: draft!.timezone,
      unitPref: draft!.unitPref,
      targetWeightKg: draft!.targetWeightKg ? Number(draft!.targetWeightKg) : null
    };
  }

  function submit(e: React.FormEvent, andRecalculate = false) {
    e.preventDefault();
    setError("");
    setNeedsWeight(false);
    save.mutate(payload(), {
      onSuccess: () => {
        if (!andRecalculate) return push("success", "Profile saved.");
        recalc.mutate(undefined, {
          onSuccess: () => push("success", "Profile saved and your daily targets were recalculated."),
          onError: (err) => {
            push("success", "Profile saved.");
            setNeedsWeight(true);
            setError(err instanceof ApiError ? err.message : "Couldn't recalculate your targets.");
          }
        });
      },
      onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save profile")
    });
  }

  const busy = save.isPending || recalc.isPending;

  return (
    <Panel>
      <form onSubmit={(e) => submit(e)} className="flex flex-col gap-5">
        <ErrorText>{error}</ErrorText>
        {needsWeight && (
          <p className="text-sm text-ink-soft">
            Targets need a weight entry. Add one on the <Link to="/weight" className="font-bold text-ink underline underline-offset-4">Weight page</Link>, or use the{" "}
            <Link to="/setup" className="font-bold text-ink underline underline-offset-4">guided setup</Link>.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name (optional)">
            <Input value={draft.displayName ?? ""} maxLength={60} onChange={(e) => set("displayName", e.target.value)} />
          </Field>
          <Field label="Units">
            <Select value={unit} onChange={(e) => set("unitPref", e.target.value as UnitPref)}>
              <option value="METRIC">Metric (kg, cm)</option>
              <option value="IMPERIAL">Imperial (lb, in)</option>
            </Select>
          </Field>
          <Field label="Date of birth">
            <Input type="date" max={new Date().toISOString().slice(0, 10)} value={draft.dateOfBirth?.slice(0, 10) ?? ""} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </Field>
          <Field label="Sex (for the calorie formula)">
            <Select value={draft.sexForCalc ?? ""} onChange={(e) => set("sexForCalc", e.target.value as Sex)}>
              <option value="">Not set</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </Select>
          </Field>
          <Field label={`Height (${heightUnitLabel(unit)})`}>
            <Input
              type="number"
              step="0.1"
              value={draft.heightCm ? cmToDisplay(Number(draft.heightCm), unit) : ""}
              onChange={(e) => set("heightCm", e.target.value ? String(displayToCm(Number(e.target.value), unit)) : "")}
            />
          </Field>
          <Field label={`Target weight (${weightUnitLabel(unit)}), optional`}>
            <Input
              type="number"
              step="0.1"
              value={draft.targetWeightKg ? kgToDisplay(Number(draft.targetWeightKg), unit) : ""}
              onChange={(e) => set("targetWeightKg", e.target.value ? String(displayToKg(Number(e.target.value), unit)) : null)}
            />
          </Field>
          <Field label="Activity level">
            <Select value={draft.activityLevel} onChange={(e) => set("activityLevel", e.target.value as ActivityLevel)}>
              {ACTIVITY.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Goal">
            <Select value={draft.goal} onChange={(e) => set("goal", e.target.value as GoalType)}>
              <option value="LOSE">Lose weight</option>
              <option value="MAINTAIN">Maintain</option>
              <option value="GAIN">Gain weight</option>
            </Select>
          </Field>
        </div>
        <Field label="Timezone" hint="Used for server-side date handling. Your diary days follow this device's calendar.">
          <Select value={draft.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>{save.isPending ? "Saving…" : "Save"}</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={(e) => submit(e, true)}>
            {recalc.isPending ? "Recalculating…" : "Save and recalculate targets"}
          </Button>
        </div>
        <p className="text-xs text-ink-soft">Saving alone never changes your daily targets. Recalculating adds a new target and keeps the old ones in history.</p>
      </form>
    </Panel>
  );
}
