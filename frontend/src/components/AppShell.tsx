import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

const NAV_ITEMS = [
  { to: "/", label: "Today", end: true },
  { to: "/foods", label: "Foods" },
  { to: "/recipes", label: "Recipes" },
  { to: "/weight", label: "Weight" },
  { to: "/progress", label: "Progress" },
  { to: "/settings", label: "Settings" }
];

export function AppShell() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-white px-4 py-6 md:flex">
        <div className="font-display px-2 text-lg font-semibold text-pine-dark">NutriTrack</div>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-pine-tint text-pine-dark" : "text-ink-soft hover:bg-paper"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => logout()}
          className="mt-auto rounded-md px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-paper"
        >
          Log out
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs font-medium ${isActive ? "text-pine-dark" : "text-ink-soft"}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
