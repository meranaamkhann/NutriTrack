import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button } from "../components/ui";

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"verifying" | "done" | "error">("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("This link is missing its verification token.");
      return;
    }
    api
      .post("/auth/verify-email", { token })
      .then(() => setStatus("done"))
      .catch((err) => {
        setStatus("error");
        setError(err instanceof ApiError ? err.message : "That link is invalid or has expired");
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="font-display mb-8 text-xl font-semibold text-pine-dark">NutriTrack</div>
        <div className="rounded-lg border border-line bg-white p-6">
          {status === "verifying" && <p className="text-sm text-ink-soft">Verifying your email…</p>}
          {status === "done" && (
            <div className="flex flex-col gap-4">
              <h1 className="font-display text-lg font-semibold text-ink">Email verified</h1>
              <Link to="/login">
                <Button className="w-full">Continue to login</Button>
              </Link>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-brick">{error}</p>
              <Link to="/login" className="text-sm font-medium text-pine">
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
