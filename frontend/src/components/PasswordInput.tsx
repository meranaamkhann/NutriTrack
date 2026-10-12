import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "./icons";

export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`w-full rounded-lg border border-line bg-white py-2 pl-3 pr-11 text-sm outline-none focus:border-pine ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-soft hover:text-ink"
      >
        <Icon name={visible ? "eye-off" : "eye"} size={18} />
      </button>
    </div>
  );
}
