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

function linkClass(isActive: boolean) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-pine-tint text-pine-dark" : "text-ink-soft hover:bg-paper"
  }`;
}

export function AppShell() {
  const { logout } = useAuth();
  const account = useAccount();
  const profile = useProfile();
  const label = profile.data?.displayName?.trim() || account.data?.email || "";
  const initial = label.charAt(0).toUpperCase() || "?";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white px-4 py-6 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <LogoMark size={30} />
          <span className="font-display text-lg font-semibold text-pine-dark">NutriTrack</span>
        </div>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => linkClass(isActive)}>
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
          <div className="my-2 border-t border-line" />
          {DESKTOP_ONLY.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClass(isActive)}>
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-line pt-4">
          <div className="mb-2 flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine text-sm font-semibold text-white">{initial}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{label || "Your account"}</p>
              {profile.data?.displayName && account.data && <p className="truncate text-xs text-ink-soft">{account.data.email}</p>}
            </div>
          </div>
          <button onClick={() => logout()} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-paper">
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <VerifyBanner />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? "text-pine-dark" : "text-ink-soft"}`
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
