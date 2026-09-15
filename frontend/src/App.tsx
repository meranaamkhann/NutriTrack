import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { AppShell } from "./components/AppShell";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Foods } from "./pages/Foods";
import { Recipes } from "./pages/Recipes";
import { RecipeDetail } from "./pages/RecipeDetail";
import { Weight } from "./pages/Weight";
import { Progress } from "./pages/Progress";
import { Settings } from "./pages/Settings";
import { QuickAdd } from "./pages/QuickAdd";

function ProtectedRoutes() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>
    );
  }
  if (status === "guest") return <Navigate to="/login" replace />;

  return (
    <AppShell />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/foods" element={<Foods />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/weight" element={<Weight />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/quick-add" element={<QuickAdd />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
