import { Icon } from "./icons";

function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const LABELS = ["Too weak", "Weak", "Okay", "Good", "Strong"];
const COLORS = ["bg-brick", "bg-brick", "bg-gold", "bg-pine", "bg-pine-dark"];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const meetsLength = password.length >= 10;
  const score = meetsLength ? scorePassword(password) : Math.min(scorePassword(password), 0);
  const rules = [
    { ok: meetsLength, label: "At least 10 characters" },
    { ok: /[A-Za-z]/.test(password), label: "A letter" },
    { ok: /\d/.test(password), label: "A number" }
  ];
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? COLORS[score] : "bg-line"}`} />
          ))}
        </div>
        <span className="w-16 text-right text-xs font-medium text-ink-soft">{LABELS[score]}</span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {rules.map((rule) => (
          <li key={rule.label} className={`flex items-center gap-1 text-xs ${rule.ok ? "text-pine" : "text-ink-soft"}`}>
            <Icon name={rule.ok ? "check" : "plus"} size={12} />
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}