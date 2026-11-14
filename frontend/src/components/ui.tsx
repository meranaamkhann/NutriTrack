import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

// A card is a label section: white, with a heavy rule on top.
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-sm border border-line border-t-[6px] border-t-ink bg-white p-5 ${className}`}>{children}</div>;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-ink-soft disabled:bg-ink-soft/40",
  secondary: "border-2 border-ink bg-white text-ink hover:bg-mark disabled:opacity-50",
  danger: "bg-alert text-white hover:bg-alert/90 disabled:opacity-50",
  ghost: "bg-transparent text-ink underline underline-offset-4 hover:bg-wash disabled:opacity-50"
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-sm px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

const CONTROL = "rounded-sm border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:bg-mark-tint";

// className is MERGED with the base styling. Spreading props after a fixed
// className used to replace it entirely, so any input given its own width
// (search bars, quantity boxes) silently lost its border and padding.
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${CONTROL} ${className}`} {...props} />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="border-l-4 border-alert bg-alert-tint px-3 py-2 text-sm font-medium text-ink">
      {children}
    </p>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 border-b-[6px] border-ink pb-3">
      <div>
        <h1 className="font-display text-3xl font-black text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-sm border-2 border-dashed border-line bg-white px-5 py-10 text-center">
      <p className="font-bold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{body}</p>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const tones = {
    neutral: "border-ink text-ink",
    good: "border-ink bg-ink text-white",
    warn: "border-ink bg-mark text-ink"
  };
  return <span className={`rounded-sm border px-1.5 text-[11px] font-bold leading-5 ${tones[tone]}`}>{children}</span>;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b-2 border-ink">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`whitespace-nowrap px-4 py-2.5 text-sm font-bold transition-colors ${
            active === tab.id ? "bg-ink text-white" : "text-ink hover:bg-mark"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
