// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signInWithOAuth } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOAuth },
  }),
}));

import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({ error: null });
});

describe("LoginForm", () => {
  it("offers Google sign-in and no magic-link email form", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /email me a link/i })).toBeNull();
  });

  it("starts Google OAuth redirected to /auth/confirm", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => {
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/confirm`,
          queryParams: { prompt: "select_account" },
        },
      });
    });
  });

  it("shows an error when Google OAuth fails to start", async () => {
    signInWithOAuth.mockResolvedValueOnce({
      error: { message: "Provider not enabled" },
    });
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => {
      expect(screen.getByText(/provider not enabled/i)).toBeTruthy();
    });
  });

  it("shows a confirm failure message from the auth callback", () => {
    render(
      <LoginForm authError="Google sign-in didn’t finish. Try Continue with Google again." />,
    );
    expect(screen.getByText(/google sign-in didn’t finish/i)).toBeTruthy();
  });
});
