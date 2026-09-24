// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword, signInWithOtp } = vi.hoisted(() => ({
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
  signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
}));

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword, signInWithOtp },
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
  signInWithOtp.mockReset();
  signInWithOtp.mockResolvedValue({ error: null });
  replace.mockReset();
  refresh.mockReset();
});

describe("LoginForm", () => {
  it("shows email and password fields with Sign in and Email me a link, no Google", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /email me a link/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /continue with google/i })).toBeNull();
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

  it("redirects to next after password sign-in", async () => {
    render(<LoginForm next="/join?code=ABCD2345" />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "secret-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/join?code=ABCD2345");
    });
  });

  it("rejects unsafe next via safeNextPath and goes home", async () => {
    render(<LoginForm next="//evil.example" />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "secret-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
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

  it("sends a magic link with shouldCreateUser false and emailRedirectTo /auth/confirm", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "guest@example.com",
        options: {
          shouldCreateUser: false,
          emailRedirectTo: expect.stringMatching(/\/auth\/callback$/),
        },
      });
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("uses NEXT_PUBLIC_SITE_URL for magic-link emailRedirectTo when set", async () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.mortang.com";
    try {
      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText(/^email$/i), {
        target: { value: "guest@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

      await waitFor(() => {
        expect(signInWithOtp).toHaveBeenCalledWith({
          email: "guest@example.com",
          options: {
            shouldCreateUser: false,
            emailRedirectTo: "https://www.mortang.com/auth/callback",
          },
        });
      });
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
  });

  it("shows inbox message on successful OTP without navigating away", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/If that address can sign in, check your inbox for a link\./),
      ).toBeTruthy();
    });
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("maps signup-disallowed OTP errors to the same inbox message", async () => {
    signInWithOtp.mockResolvedValueOnce({
      error: { message: "Signups not allowed for otp" },
    });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "unknown@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/If that address can sign in, check your inbox for a link\./),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/signups not allowed/i)).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("still shows distinct OTP transport errors", async () => {
    signInWithOtp.mockResolvedValueOnce({
      error: { message: "Request rate limit reached" },
    });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(screen.getByText(/request rate limit reached/i)).toBeTruthy();
    });
  });

  it("requires an email before sending a magic link", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter your email/i)).toBeTruthy();
    });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});
