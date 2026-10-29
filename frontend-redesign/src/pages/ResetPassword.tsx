import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordStrength } from "../components/PasswordStrength";
import { Button, ErrorText, Field } from "../components/ui";

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/password-reset/confirm", { token, newPassword });
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That link is invalid or has expired");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Link not valid">
        <p className="text-sm text-ink-soft">This link is missing its reset token.</p>
        <Link to="/forgot-password" className="mt-4 inline-block text-sm font-bold text-ink underline underline-offset-4">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }
  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="Taking you to the login page…">
        <span />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorText>{error}</ErrorText>
        <Field label="New password">
          <PasswordInput required minLength={10} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
        <PasswordStrength password={newPassword} />
        <Button type="submit" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
