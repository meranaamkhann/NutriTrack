import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input } from "../components/ui";

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

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="font-display mb-8 text-center text-xl font-semibold text-pine-dark">NutriTrack</div>
        <div className="rounded-lg border border-line bg-white p-6">
          {!token ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-ink-soft">
                This link is missing its reset token. Request a new one from the login page.
              </p>
              <Link to="/forgot-password" className="text-sm font-medium text-pine">
                Request a new link
              </Link>
            </div>
          ) : done ? (
            <div className="flex flex-col gap-4 text-center">
              <h1 className="font-display text-lg font-semibold text-ink">Password updated</h1>
              <p className="text-sm text-ink-soft">Taking you to the login page…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <h1 className="font-display text-lg font-semibold text-ink">Set a new password</h1>
              <ErrorText>{error}</ErrorText>
              <Field label="New password">
                <Input
                  type="password"
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <p className="text-xs text-ink-soft">At least 10 characters, with a letter and a number.</p>
              <Button type="submit" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
