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

function revealPassword() {
  fireEvent.click(screen.getByRole("button", { name: /use a password instead/i }));
}

describe("LoginForm", () => {
  it("defaults to email + Email me a link, password hidden, no Google", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();
    expect(screen.getByRole("button", { name: /email me a link/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^sign in$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /use a password instead/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /continue with google/i })).toBeNull();
  });

  it("reveals password sign-in when asked, then signs in", async () => {
    render(<LoginForm />);
    revealPassword();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
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

  it("returns to magic-link mode from password mode", () => {
    render(<LoginForm />);
    revealPassword();
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /email me a link instead/i }));
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();
    expect(screen.getByRole("button", { name: /email me a link/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^sign in$/i })).toBeNull();
  });

  it("redirects to next after password sign-in", async () => {
    render(<LoginForm next="/join?code=ABCD2345" />);
    revealPassword();
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
    revealPassword();
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
    revealPassword();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/invalid login credentials/i);
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("requires a password in password mode", async () => {
    render(<LoginForm />);
    revealPassword();
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/enter your password/i);
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("Enter in link mode sends a magic link, not password", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.submit(screen.getByLabelText(/^email$/i).closest("form")!);

    await waitFor(() => {
      expect(signInWithOtp).toHaveBeenCalled();
      expect(signInWithPassword).not.toHaveBeenCalled();
    });
  });

  it("sends a magic link with shouldCreateUser false and emailRedirectTo /auth/callback", async () => {
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

  it("shows inbox status on successful OTP without navigating away", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(
        /If that address can sign in, check your inbox for a link\./,
      );
    });
    expect(screen.getByText("guest@example.com")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /check your inbox/i })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("maps signup-disallowed OTP errors to the same inbox status", async () => {
    signInWithOtp.mockResolvedValueOnce({
      error: { message: "Signups not allowed for otp" },
    });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "unknown@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(
        /If that address can sign in, check your inbox for a link\./,
      );
    });
    expect(screen.queryByText(/signups not allowed/i)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("lets the user return from the inbox panel to edit email", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /use a different email/i }));
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("still shows distinct OTP transport errors as alerts", async () => {
    signInWithOtp.mockResolvedValueOnce({
      error: { message: "Request rate limit reached" },
    });
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/request rate limit reached/i);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("requires an email before sending a magic link", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/enter your email/i);
    });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("shows a confirm authError as an alert on the form", () => {
    render(<LoginForm authError="That sign-in link didn’t finish. Request a new one." />);
    expect(screen.getByRole("alert").textContent).toMatch(/sign-in link didn’t finish/i);
  });
});
