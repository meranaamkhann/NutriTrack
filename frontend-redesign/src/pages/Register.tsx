import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordStrength } from "../components/PasswordStrength";
import { Button, ErrorText, Field, Input } from "../components/ui";

export function Register() {
  const { register, login } = useAuth();
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
      await register(email, password);
      await login(email, password);
      navigate("/setup");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Next you'll set a daily target that fits you. It takes about a minute.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <ErrorText>{error}</ErrorText>
        <Field label="Email">
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <PasswordInput required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <PasswordStrength password={password} />
        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </Button>
        <p className="text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-ink underline underline-offset-4">
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
