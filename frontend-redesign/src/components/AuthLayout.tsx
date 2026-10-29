import type { ReactNode } from "react";
import { LogoMark } from "./icons";

const POINTS = [
  "Targets built from your own body and goal, not a generic 2,000",
  "Recipes, custom foods and a diary you can edit any day",
  "Your data stays yours: export it or delete it whenever you like"
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <aside className="hidden border-r-[12px] border-ink bg-white p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark size={36} />
          <span className="font-display text-xl font-black">NutriTrack</span>
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-6xl font-black leading-[0.95]">Know what&rsquo;s on your plate.</h2>
          <p className="mt-5 text-base text-ink-soft">
            Log meals in seconds, see your calories and macros against a target that fits you, and watch the trend over time.
          </p>
          <ul className="mt-8 border-t-[6px] border-ink">
            {POINTS.map((point) => (
              <li key={point} className="border-b border-line py-3 text-sm font-medium">
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-ink-soft">Estimates only. Not medical advice.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark size={30} />
            <span className="font-display text-lg font-black">NutriTrack</span>
          </div>
          <h1 className="border-b-[6px] border-ink pb-2 font-display text-3xl font-black">{title}</h1>
          {subtitle && <p className="mt-3 text-sm text-ink-soft">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
