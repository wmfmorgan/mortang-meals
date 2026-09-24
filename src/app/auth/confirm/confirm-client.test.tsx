// @vitest-environment happy-dom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtp, exchangeCodeForSession, setSession } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
}));

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const { completeInviteSignInAction } = vi.hoisted(() => ({
  completeInviteSignInAction: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { verifyOtp, exchangeCodeForSession, setSession },
  }),
}));

vi.mock("@/app/household/actions", () => ({
  completeInviteSignInAction: (...args: unknown[]) =>
    completeInviteSignInAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

import { ConfirmClient } from "./confirm-client";

afterEach(() => {
  cleanup();
  verifyOtp.mockReset();
  exchangeCodeForSession.mockReset();
  setSession.mockReset();
  completeInviteSignInAction.mockReset();
  replace.mockReset();
  refresh.mockReset();
  window.history.replaceState({}, "", "/auth/confirm");
  window.location.hash = "";
});

beforeEach(() => {
  verifyOtp.mockResolvedValue({ error: null });
  exchangeCodeForSession.mockResolvedValue({ error: null });
  setSession.mockResolvedValue({ error: null });
  completeInviteSignInAction.mockResolvedValue({ ok: true, joined: false });
});

describe("ConfirmClient", () => {
  it("preserves next on invalid confirm failure redirect", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/confirm?next=%2Fjoin%3Fcode%3DABCD2345",
    );
    render(<ConfirmClient />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/login?error=confirm&next=%2Fjoin%3Fcode%3DABCD2345",
      );
    });
  });

  it("preserves next when OTP verify fails", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/confirm?token_hash=abc&type=email&next=%2Fhousehold",
    );
    verifyOtp.mockResolvedValueOnce({ error: { message: "Token expired" } });
    render(<ConfirmClient />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/login?error=confirm&next=%2Fhousehold",
      );
    });
  });

  it("omits next on failure when it was not present", async () => {
    window.history.replaceState({}, "", "/auth/confirm");
    render(<ConfirmClient />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?error=confirm");
    });
  });

  it("goes home when a pending invite is accepted after confirm", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      assign,
      search: "?token_hash=abc&type=email",
      hash: "",
    });
    window.history.replaceState(
      {},
      "",
      "/auth/confirm?token_hash=abc&type=email",
    );
    completeInviteSignInAction.mockResolvedValueOnce({
      ok: true,
      joined: true,
    });
    render(<ConfirmClient />);

    await waitFor(() => {
      expect(completeInviteSignInAction).toHaveBeenCalled();
      expect(assign).toHaveBeenCalledWith("/");
    });
    vi.unstubAllGlobals();
  });
});
