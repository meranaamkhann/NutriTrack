import { StrictMode } from "react";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../src/lib/auth";
import { AccountTab } from "../src/pages/settings/AccountTab";
import { mockApi, renderApp } from "./helpers";

const account = { id: "u1", email: "asad@example.com", emailVerified: true, createdAt: "2026-01-01T00:00:00Z", role: "USER" };

describe("startup session refresh", () => {
  it("asks the server to refresh once even when StrictMode runs the effect twice", async () => {
    const calls = mockApi({ "POST /auth/refresh": () => ({ accessToken: "t" }), "GET /account/me": () => account });
    renderApp(
      <StrictMode>
        <AuthProvider>
          <AccountTab />
        </AuthProvider>
      </StrictMode>
    );
    await screen.findByText("asad@example.com");
    expect(calls.filter((c) => c.path === "/auth/refresh")).toHaveLength(1);
  });
});

describe("pending email change", () => {
  it("shows the address still waiting for confirmation and offers a resend", async () => {
    mockApi({
      "POST /auth/refresh": () => ({ accessToken: "t" }),
      "GET /account/me": () => ({ ...account, pendingEmail: "new@example.com" })
    });
    renderApp(<AuthProvider><AccountTab /></AuthProvider>);
    expect(await screen.findByText("new@example.com")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Resend verification email" })).toBeTruthy());
  });
});
