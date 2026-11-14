import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useAccount, useProfile } from "../lib/queries";
import { Icon, LogoMark, type IconName } from "./icons";
import { VerifyBanner } from "./VerifyBanner";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Diary", icon: "calendar", end: true },
  { to: "/foods", label: "Foods", icon: "apple" },
  { to: "/recipes", label: "Recipes", icon: "book" },
  { to: "/weight", label: "Weight", icon: "activity" },
  { to: "/progress", label: "Progress", icon: "chart" },
  { to: "/settings", label: "Settings", icon: "sliders" }
];

// Kept off the mobile tab bar (six items is the practical ceiling there);
// on phones it is reached from the "Quick add" button on the Diary.
const DESKTOP_ONLY: NavItem[] = [{ to: "/quick-add", label: "Quick add", icon: "zap" }];

function topLinkClass(isActive: boolean) {
  return `px-2.5 py-1.5 text-sm font-bold ${isActive ? "bg-mark text-ink" : "text-ink hover:bg-wash"}`;
}

export function AppShell() {
  const { logout } = useAuth();
  const account = useAccount();
  const profile = useProfile();
  const label = profile.data?.displayName?.trim() || account.data?.email || "";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-[6px] border-ink bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 md:px-8">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-display text-lg font-black">NutriTrack</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {[...NAV_ITEMS, ...DESKTOP_ONLY].map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => topLinkClass(isActive)}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-ink-soft lg:block">{label}</span>
            <button onClick={() => logout()} className="px-2.5 py-1.5 text-sm font-bold underline underline-offset-4 hover:bg-wash">
              Log out
            </button>
          </div>
        </div>
      </header>

      <VerifyBanner />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-12 md:pt-10">
        <Outlet />
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 flex border-t-4 border-ink bg-white md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${isActive ? "bg-mark text-ink" : "text-ink-soft"}`
            }
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
