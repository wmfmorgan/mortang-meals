// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signInWithOtp } = vi.hoisted(() => ({
  signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOtp },
  }),
}));

import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  signInWithOtp.mockReset();
  signInWithOtp.mockResolvedValue({ error: null });
});

describe("LoginForm", () => {
  it("asks for an email and offers a magic link", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /email me a link/i })).toBeTruthy();
  });

  it("sends a magic link without creating a user and shows the same success copy", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: null });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "guest@example.com",
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      expect(
        screen.getByText("If that address can sign in, check your inbox."),
      ).toBeTruthy();
    });
  });

  it("shows the same success copy when the address cannot sign in", async () => {
    signInWithOtp.mockResolvedValueOnce({
      error: { message: "Signups not allowed for otp" },
    });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "unknown@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(
        screen.getByText("If that address can sign in, check your inbox."),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/signups not allowed/i)).toBeNull();
  });
});
