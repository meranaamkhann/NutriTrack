import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input } from "../components/ui";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/password-reset/request", { email });
      // Always show the same success state regardless of whether the email
      // exists — matches the backend's no-enumeration response.
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="font-display mb-8 text-center text-xl font-semibold text-pine-dark">NutriTrack</div>
        <div className="rounded-lg border border-line bg-white p-6">
          {sent ? (
            <div className="flex flex-col gap-4 text-center">
              <h1 className="font-display text-lg font-semibold text-ink">Check your email</h1>
              <p className="text-sm text-ink-soft">
                If an account exists for {email}, a password reset link is on its way. It expires in 1 hour.
              </p>
              <Link to="/login" className="text-sm font-medium text-pine">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <h1 className="font-display text-lg font-semibold text-ink">Reset your password</h1>
              <p className="text-sm text-ink-soft">Enter your email and we'll send you a reset link.</p>
              <ErrorText>{error}</ErrorText>
              <Field label="Email">
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Button type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <p className="text-center text-sm text-ink-soft">
                <Link to="/login" className="font-medium text-pine">
                  Back to login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
