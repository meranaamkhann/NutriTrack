import { useState } from "react";
import { ApiError } from "../../lib/api";
import { useChangePassword, useRevokeOtherSessions, useRevokeSession, useSessions } from "../../lib/queries";
import { useToast } from "../../lib/toast";
import { Badge, Button, ErrorText, Field, Panel } from "../../components/ui";
import { PasswordInput } from "../../components/PasswordInput";
import { PasswordStrength } from "../../components/PasswordStrength";
import { ListSkeleton } from "../../components/Skeleton";

function ChangePasswordPanel() {
  const { push } = useToast();
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const mismatch = confirm.length > 0 && confirm !== next;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) return setError("The two new passwords don't match.");
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setConfirm("");
          push("success", "Password changed. Your other devices were signed out.");
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't change your password.")
      }
    );
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Change password</h2>
          <p className="mt-1 text-sm text-ink-soft">Changing it signs you out everywhere else, and we email you a notice.</p>
        </div>
        <ErrorText>{error}</ErrorText>
        <Field label="Current password">
          <PasswordInput required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password">
          <PasswordInput required minLength={10} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <PasswordStrength password={next} />
        <Field label="Confirm new password" hint={mismatch ? "These don't match yet." : undefined}>
          <PasswordInput required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" disabled={change.isPending || !current || !next || mismatch} className="self-start">
          {change.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Panel>
  );
}

function lastActive(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return "Active just now";
  if (minutes < 60) return `Active ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `Active ${days} day${days === 1 ? "" : "s"} ago`;
}

function SessionsPanel() {
  const { push } = useToast();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const others = (sessions.data ?? []).filter((s) => !s.current);

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Where you're signed in</h2>
          <p className="mt-1 text-sm text-ink-soft">If you see a device you don't recognise, sign it out and change your password.</p>
        </div>
        {others.length > 0 && (
          <Button
            variant="secondary"
            disabled={revokeOthers.isPending}
            onClick={() =>
              revokeOthers.mutate(undefined, {
                onSuccess: () => push("success", "Signed out of all other devices."),
                onError: () => push("error", "Couldn't sign out the other devices.")
              })
            }
          >
            {revokeOthers.isPending ? "Signing out…" : "Sign out all other devices"}
          </Button>
        )}
      </div>
      {sessions.isLoading ? (
        <ListSkeleton rows={2} />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span className="truncate">{s.device}</span>
                  {s.current && <Badge tone="good">This device</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {lastActive(s.lastActiveAt)}
                  {s.ip && s.ip !== "::1" && s.ip !== "127.0.0.1" ? ` · ${s.ip}` : ""}
                </p>
              </div>
              {!s.current && (
                <button
                  onClick={() =>
                    revoke.mutate(s.id, {
                      onSuccess: () => push("success", "Signed that device out."),
                      onError: (err) => push("error", err instanceof ApiError ? err.message : "Couldn't sign that device out.")
                    })
                  }
                  disabled={revoke.isPending}
                  className="shrink-0 text-xs font-medium text-brick hover:underline"
                >
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-soft">
        A signed-out device can keep using the app for up to 15 minutes, until its short-lived access pass expires.
      </p>
    </Panel>
  );
}

export function SecurityTab() {
  return (
    <div className="flex flex-col gap-6">
      <ChangePasswordPanel />
      <SessionsPanel />
    </div>
  );
}
