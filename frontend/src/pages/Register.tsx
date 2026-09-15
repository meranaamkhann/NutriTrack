import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input } from "../components/ui";

export function Register() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password);
      setNotice("Account created. Check your email to verify it, then log in.");
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
          <h1 className="font-display text-lg font-semibold text-ink">Create your account</h1>
          <ErrorText>{error}</ErrorText>
          {notice && <p className="rounded-md bg-pine-tint px-3 py-2 text-sm text-pine-dark">{notice}</p>}
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <p className="text-xs text-ink-soft">At least 10 characters, with a letter and a number.</p>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </Button>
          <p className="text-center text-sm text-ink-soft">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-pine">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
