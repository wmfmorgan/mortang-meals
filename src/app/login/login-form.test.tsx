// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword } = vi.hoisted(() => ({
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
}));

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  signInWithPassword.mockReset();
  signInWithPassword.mockResolvedValue({ error: null });
  replace.mockReset();
  refresh.mockReset();
});

describe("LoginForm", () => {
  it("shows email and password fields and no Google or magic-link controls", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /continue with google/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /email me a link/i })).toBeNull();
  });

  it("signs in with email and password then goes home", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "secret-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "guest@example.com",
        password: "secret-pass",
      });
      expect(replace).toHaveBeenCalledWith("/");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("shows an error when credentials are rejected", async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" },
    });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeTruthy();
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
