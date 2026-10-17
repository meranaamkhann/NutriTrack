import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../src/lib/auth";
import { AccountTab } from "../src/pages/settings/AccountTab";
import { SecurityTab } from "../src/pages/settings/SecurityTab";
import { mockApi, renderApp } from "./helpers";

const sessions = [
  { id: "s-here", device: "Chrome on Windows", ip: "::1", lastActiveAt: new Date().toISOString(), current: true },
  { id: "s-phone", device: "Safari on iOS", ip: "203.0.113.9", lastActiveAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), current: false }
];

function fillPasswords(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
}

describe("change password", () => {
  it("blocks submitting while the confirmation doesn't match", async () => {
    mockApi({ "GET /account/sessions": () => sessions });
    renderApp(<SecurityTab />);
    fillPasswords("old-password-1", "brandnewpass22", "brandnewpass2");
    expect(screen.getByText("These don't match yet.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Update password" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends the right payload and clears the form on success", async () => {
    const calls = mockApi({ "GET /account/sessions": () => sessions, "POST /account/change-password": () => ({ message: "ok" }) });
    renderApp(<SecurityTab />);
    fillPasswords("old-password-1", "brandnewpass22", "brandnewpass22");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(calls.some((c) => c.path === "/account/change-password")).toBe(true));
    expect(calls.find((c) => c.path === "/account/change-password")!.body).toEqual({ currentPassword: "old-password-1", newPassword: "brandnewpass22" });
    await waitFor(() => expect((screen.getByLabelText("Current password") as HTMLInputElement).value).toBe(""));
  });

  it("shows 'current password is incorrect' without treating it as an expired session", async () => {
    const calls = mockApi({
      "GET /account/sessions": () => sessions,
      "POST /account/change-password": () => ({ __status: 403, body: { error: "INVALID_PASSWORD", message: "Current password is incorrect" } })
    });
    renderApp(<SecurityTab />);
    fillPasswords("wrong-password-1", "brandnewpass22", "brandnewpass22");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Current password is incorrect")).toBeTruthy();
    expect(calls.filter((c) => c.path === "/account/change-password")).toHaveLength(1);
    expect(calls.some((c) => c.path === "/auth/refresh")).toBe(false);
  });

  it("every password box has a working eye toggle", () => {
    mockApi({ "GET /account/sessions": () => sessions });
    renderApp(<SecurityTab />);
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(3);
  });
});

describe("signed-in devices", () => {
  it("marks this device, offers sign-out for the others only, and signs one out", async () => {
    const calls = mockApi({ "GET /account/sessions": () => sessions, "DELETE /account/sessions/:id": () => undefined });
    renderApp(<SecurityTab />);

    expect(await screen.findByText("This device")).toBeTruthy();
    expect(screen.getByText("Safari on iOS")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/account/sessions/s-phone")).toBe(true));
  });
});

describe("account", () => {
  const account = { id: "u1", email: "asad@example.com", emailVerified: false, createdAt: "2026-01-01T00:00:00Z", role: "USER" };

  it("flags an unverified email and can resend the link", async () => {
    const calls = mockApi({ "POST /auth/refresh": () => ({ accessToken: "t" }), "GET /account/me": () => account, "POST /auth/verify-email/resend": () => ({ message: "sent" }) });
    renderApp(<AuthProvider><AccountTab /></AuthProvider>);
    expect(await screen.findByText("Not verified")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/auth/verify-email/resend")).toBe(true));
    expect(calls.find((c) => c.path === "/auth/verify-email/resend")!.body).toEqual({ email: "asad@example.com" });
  });

  it("asks for the password before deleting, and the box has an eye toggle", async () => {
    mockApi({ "POST /auth/refresh": () => ({ accessToken: "t" }), "GET /account/me": () => account });
    renderApp(<AuthProvider><AccountTab /></AuthProvider>);
    await screen.findByText("Not verified");
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Permanently delete" }) as HTMLButtonElement).disabled).toBe(true);
  });
});