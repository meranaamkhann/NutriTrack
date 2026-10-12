import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { AuthProvider } from "./lib/auth.tsx";
import { ToastProvider } from "./lib/toast.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data that's a few seconds stale is still fine to show instantly
      // while a background refetch happens — this is what makes navigating
      // between already-visited tabs feel instant instead of re-flashing a
      // loading skeleton every single time.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
