import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAccount } from "../lib/queries";
import { useToast } from "../lib/toast";
import { Icon } from "./icons";

export function VerifyBanner() {
  const account = useAccount();
  const { push } = useToast();
  const [sending, setSending] = useState(false);

  if (!account.data || account.data.emailVerified) return null;
  const email = account.data.email;

  async function resend() {
    setSending(true);
    try {
      await api.post("/auth/verify-email/resend", { email });
      push("success", "Verification email sent. Check your inbox.");
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Could not send the email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-mark-tint px-4 py-2 text-center text-sm text-ink">
      <Icon name="alert" size={16} />
      <span>
        Please verify <strong>{email}</strong> so you can recover your account if you forget your password.
      </span>
      <button onClick={resend} disabled={sending} className="font-semibold text-ink underline underline-offset-2 disabled:opacity-60">
        {sending ? "Sending…" : "Resend email"}
      </button>
    </div>
  );
}
