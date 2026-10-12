import type { ReactNode } from "react";
import { LogoMark } from "./icons";

function LeafPattern() {
  return (
    <svg className="absolute -bottom-10 -right-10 h-80 w-80 text-white opacity-[0.07]" viewBox="0 0 200 200" aria-hidden="true">
      <path d="M20 180C20 90 80 20 190 20c0 100-60 160-170 160z" fill="currentColor" />
      <path d="M20 180C70 120 110 80 160 50" stroke="#163f36" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-pine-dark to-pine p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark size={36} />
          <span className="font-display text-xl font-semibold">NutriTrack</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight">Know what's on your plate.</h2>
          <p className="mt-4 text-base text-white/75">
            Log meals in seconds, see your calories and macros against a target that fits you, and watch the trend
            over time.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-sm text-white/85">
            <li>Targets built from your own body and goal, not a generic 2,000</li>
            <li>Recipes, custom foods and a diary you can edit any day</li>
            <li>Your data stays yours: export it or delete it whenever you like</li>
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/55">Estimates only. Not medical advice.</p>
        <LeafPattern />
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <LogoMark size={30} />
            <span className="font-display text-lg font-semibold text-pine-dark">NutriTrack</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
