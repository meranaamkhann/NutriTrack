import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useAccount, useChangeEmail } from "../../lib/queries";
import { useToast } from "../../lib/toast";
import { Badge, Button, ErrorText, Field, Input, Panel } from "../../components/ui";
import { PasswordInput } from "../../components/PasswordInput";
import { PanelSkeleton } from "../../components/Skeleton";

function EmailPanel() {
  const { push } = useToast();
  const account = useAccount();
  const changeEmail = useChangeEmail();
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  if (account.isLoading || !account.data) return <PanelSkeleton />;
  const { email, emailVerified, createdAt } = account.data;

  async function resend() {
    setResending(true);
    try {
      await api.post("/auth/verify-email/resend", { email });
      push("success", "Verification email sent.");
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Couldn't send the email.");
    } finally {
      setResending(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    changeEmail.mutate(
      { newEmail, password },
      {
        onSuccess: () => {
          setEditing(false);
          setNewEmail("");
          setPassword("");
          push("success", "Email changed. Check the new address to verify it.");
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't change your email.")
      }
    );
  }

  return (
    <Panel>
      <h2 className="font-display text-base font-semibold text-ink">Email</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-ink">{email}</span>
        <Badge tone={emailVerified ? "good" : "warn"}>{emailVerified ? "Verified" : "Not verified"}</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Member since {new Date(createdAt).toLocaleDateString()}</p>

      {!emailVerified && (
        <Button variant="secondary" onClick={resend} disabled={resending} className="mt-4">
          {resending ? "Sending…" : "Resend verification email"}
        </Button>
      )}

      {!editing ? (
        <div className="mt-4">
          <Button variant="ghost" onClick={() => setEditing(true)} className="px-0 text-ink hover:bg-transparent hover:underline">
            Change email address
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 flex max-w-md flex-col gap-4 border-t border-line pt-5">
          <p className="text-sm text-ink-soft">
            We'll verify the new address, and send a notice to the current one so you'd spot an unwanted change.
          </p>
          <ErrorText>{error}</ErrorText>
          <Field label="New email">
            <Input type="email" required autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </Field>
          <Field label="Confirm with your password">
            <PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="flex gap-3">
            <Button type="submit" disabled={changeEmail.isPending}>
              {changeEmail.isPending ? "Saving…" : "Change email"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setEditing(false); setError(""); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function ExportPanel() {
  const { push } = useToast();
  const [busy, setBusy] = useState<"JSON" | "CSV" | null>(null);

  async function download(format: "JSON" | "CSV") {
    setBusy(format);
    try {
      const job = await api.post<{ jobId: string; token: string }>("/export", { format });
      await api.downloadBlob(`/export/${job.jobId}`, { token: job.token }, `nutritrack-export.${format.toLowerCase()}`);
      push("success", `${format} export downloaded.`);
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel>
      <h2 className="font-display text-base font-semibold text-ink">Your data</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Download everything you've stored: profile, targets, weights, foods, recipes and your diary. JSON has all of it; CSV is the food diary only.
      </p>
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" onClick={() => download("JSON")} disabled={busy !== null}>
          {busy === "JSON" ? "Preparing…" : "Download JSON"}
        </Button>
        <Button variant="secondary" onClick={() => download("CSV")} disabled={busy !== null}>
          {busy === "CSV" ? "Preparing…" : "Download CSV"}
        </Button>
      </div>
    </Panel>
  );
}

function DeletePanel() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.delete("/account/me", { password });
      await logout();
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete your account.");
      setBusy(false);
    }
  }

  return (
    <Panel className="border-alert/30">
      <h2 className="font-display text-base font-semibold text-alert">Delete account</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Permanently deletes your profile, diary, recipes, foods and weight history. This can't be undone, so download your data first if you want a copy.
      </p>
      {!open ? (
        <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      ) : (
        <form onSubmit={confirmDelete} className="mt-4 flex max-w-md flex-col gap-3">
          <ErrorText>{error}</ErrorText>
          <Field label="Enter your password to confirm">
            <PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="flex gap-3">
            <Button type="submit" variant="danger" disabled={busy || !password}>
              {busy ? "Deleting…" : "Permanently delete"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setPassword(""); setError(""); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

export function AccountTab() {
  return (
    <div className="flex flex-col gap-6">
      <EmailPanel />
      <ExportPanel />
      <DeletePanel />
    </div>
  );
}
