import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../src/lib/toast";

export function renderApp(ui: ReactElement, route = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>{ui}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

type Handler = (url: URL, init?: RequestInit) => unknown;
export interface Failure {
  __status: number;
  body?: unknown;
}

function matchRoute(routes: Record<string, Handler>, method: string, path: string): Handler | undefined {
  const exact = routes[`${method} ${path}`];
  if (exact) return exact;
  for (const [key, handler] of Object.entries(routes)) {
    const [m, pattern] = key.split(" ");
    if (m !== method || !pattern.includes(":")) continue;
    const regex = new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "$");
    if (regex.test(path)) return handler;
  }
  return undefined;
}
export function mockApi(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; search: string; body: unknown }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/api/, "");
    calls.push({ method, path, search: url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const handler = matchRoute(routes, method, path);
    const json = { "content-type": "application/json" };
    if (!handler) return new Response(JSON.stringify({ error: "NOT_FOUND", message: "no mock for " + method + " " + path }), { status: 404, headers: json });
    const result = handler(url, init);
    if (result === undefined) return new Response(null, { status: 204 });
    if (typeof result === "object" && result !== null && "__status" in result) {
      const failure = result as Failure;
      return new Response(JSON.stringify(failure.body ?? { error: "ERROR", message: "failed" }), { status: failure.__status, headers: json });
    }
    return new Response(JSON.stringify(result), { status: 200, headers: json });
  }) as typeof fetch;
  return calls;
}
