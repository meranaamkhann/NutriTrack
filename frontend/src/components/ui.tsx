import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-white p-5 ${className}`}>{children}</div>;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-pine text-white hover:bg-pine-dark disabled:bg-ink-soft/40",
    secondary: "bg-transparent text-pine border border-pine hover:bg-pine-tint",
    danger: "bg-brick text-white hover:bg-brick/90"
  };
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-pine"
      {...props}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-pine"
      {...props}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-md bg-brick-tint px-3 py-2 text-sm text-brick">{children}</p>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{body}</p>
    </div>
  );
}
