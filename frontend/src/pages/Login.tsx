import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input } from "../components/ui";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
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
        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-line bg-white p-6">
          <h1 className="font-display text-lg font-semibold text-ink">Log in</h1>
          <ErrorText>{error}</ErrorText>
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Link to="/forgot-password" className="-mt-2 text-right text-sm font-medium text-pine">
            Forgot password?
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </Button>
          <p className="text-center text-sm text-ink-soft">
            No account?{" "}
            <Link to="/register" className="font-medium text-pine">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
