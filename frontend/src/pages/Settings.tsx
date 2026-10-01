import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { ActivityLevel, GoalHistoryEntry, GoalType, Profile, Sex } from "../lib/types";
import { Button, ErrorText, Field, Input, PageHeader, Panel, Select } from "../components/ui";
import { PanelSkeleton } from "../components/Skeleton";
import { useToast } from "../lib/toast";

const ACTIVITY_LEVELS: ActivityLevel[] = ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"];
const GOALS: GoalType[] = ["LOSE", "MAINTAIN", "GAIN"];

export function Settings() {
  const { logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goal, setGoal] = useState<GoalHistoryEntry | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Profile>("/users/me").then(setProfile);
    api.get<GoalHistoryEntry | null>("/users/me/goals/current").then(setGoal);
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError("");
    setSaving(true);
    try {
      await api.put("/users/me", {
        dateOfBirth: profile.dateOfBirth || undefined,
        sexForCalc: profile.sexForCalc || undefined,
        heightCm: profile.heightCm ? Number(profile.heightCm) : undefined,
        activityLevel: profile.activityLevel,
        goal: profile.goal,
        timezone: profile.timezone
      });
      push("success", "Profile saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function recalc() {
    setError("");
    try {
      const newGoal = await api.post<GoalHistoryEntry>("/users/me/goals/recalculate");
      setGoal(newGoal);
      push("success", "Goals recalculated from your latest profile and weight.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Add a weight entry and complete your profile first");
    }
  }

  async function downloadExport(format: "JSON" | "CSV") {
    try {
      const job = await api.post<{ jobId: string; token: string }>("/export", { format });
      await api.downloadBlob(`/export/${job.jobId}`, { token: job.token }, `nutritrack-export.${format.toLowerCase()}`);
      push("success", `${format} export downloaded.`);
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Export failed");
    }
  }

  if (!profile) return <PanelSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" />
      <ErrorText>{error}</ErrorText>

      <Panel>
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of birth">
              <Input
                type="date"
                value={profile.dateOfBirth?.slice(0, 10) ?? ""}
                onChange={(e) => set("dateOfBirth", e.target.value)}
              />
            </Field>
            <Field label="Sex (for calorie formula)">
              <Select value={profile.sexForCalc ?? ""} onChange={(e) => set("sexForCalc", e.target.value as Sex)}>
                <option value="">Not set</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </Select>
            </Field>
            <Field label="Height (cm)">
              <Input
                type="number"
                min="90"
                max="260"
                value={profile.heightCm ?? ""}
                onChange={(e) => set("heightCm", e.target.value)}
              />
            </Field>
            <Field label="Timezone">
              <Input value={profile.timezone} onChange={(e) => set("timezone", e.target.value)} />
            </Field>
            <Field label="Activity level">
              <Select value={profile.activityLevel} onChange={(e) => set("activityLevel", e.target.value as ActivityLevel)}>
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a} value={a}>
                    {a[0] + a.slice(1).toLowerCase().replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Goal">
              <Select value={profile.goal} onChange={(e) => set("goal", e.target.value as GoalType)}>
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g[0] + g.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Calorie & macro targets</h2>
        {goal ? (
          <div className="mb-4 grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="font-display text-lg font-semibold text-ink">{Math.round(Number(goal.calorieTarget))}</p>
              <p className="text-xs text-ink-soft">kcal target</p>
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-ink">{Math.round(Number(goal.proteinGTarget))}g</p>
              <p className="text-xs text-ink-soft">protein</p>
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-ink">{Math.round(Number(goal.carbGTarget))}g</p>
              <p className="text-xs text-ink-soft">carbs</p>
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-ink">{Math.round(Number(goal.fatGTarget))}g</p>
              <p className="text-xs text-ink-soft">fat</p>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-ink-soft">No target calculated yet.</p>
        )}
        <p className="mb-3 text-xs text-ink-soft">
          These are estimates from the Mifflin-St Jeor formula, not medical advice. Recalculating uses your
          most recent profile and weight entry, and never changes past days' targets.
        </p>
        <Button variant="secondary" onClick={recalc}>
          Recalculate from latest profile & weight
        </Button>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Export your data</h2>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => downloadExport("JSON")}>
            Download JSON
          </Button>
          <Button variant="secondary" onClick={() => downloadExport("CSV")}>
            Download CSV
          </Button>
        </div>
      </Panel>

      <DeleteAccountPanel
        onDeleted={() => {
          logout();
          navigate("/login");
        }}
      />
    </div>
  );
}

function DeleteAccountPanel({ onDeleted }: { onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDeleting(true);
    try {
      await api.delete("/account/me", { password });
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete account");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Panel className="border-brick/30">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brick">Delete account</h2>
      <p className="mb-4 text-sm text-ink-soft">
        This permanently deletes your profile, logs, recipes, foods, and weight history. This can't be undone.
      </p>
      {!confirming ? (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete my account
        </Button>
      ) : (
        <form onSubmit={confirmDelete} className="flex flex-col gap-3">
          <ErrorText>{error}</ErrorText>
          <Field label="Confirm your password to continue">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="flex gap-3">
            <Button type="submit" variant="danger" disabled={deleting}>
              {deleting ? "Deleting…" : "Permanently delete"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}
