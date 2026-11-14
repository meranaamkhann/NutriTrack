import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui";

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"verifying" | "done" | "error">(token ? "verifying" : "error");
  const [error, setError] = useState(token ? "" : "This link is missing its verification token.");

  useEffect(() => {
    if (!token) return;
    api
      .post("/auth/verify-email", { token })
      .then(() => setStatus("done"))
      .catch((err) => {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "That link is invalid or has expired");
      });
  }, [token]);

  if (status === "verifying") return <AuthLayout title="Verifying your email…"><span /></AuthLayout>;
  if (status === "done") {
    return (
      <AuthLayout title="Email verified" subtitle="Thanks. You're all set.">
        <Link to="/">
          <Button className="w-full">Continue</Button>
        </Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Couldn't verify">
      <p className="text-sm text-alert">{error}</p>
      <p className="mt-3 text-sm text-ink-soft">Log in and use "Resend verification email" from the banner or Settings → Account.</p>
      <Link to="/login" className="mt-4 inline-block text-sm font-bold text-ink underline underline-offset-4">
        Back to login
      </Link>
    </AuthLayout>
  );
}
