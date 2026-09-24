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

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { verifyOtp, exchangeCodeForSession, setSession },
  }),
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
  replace.mockReset();
  refresh.mockReset();
  window.history.replaceState({}, "", "/auth/confirm");
  window.location.hash = "";
});

beforeEach(() => {
  verifyOtp.mockResolvedValue({ error: null });
  exchangeCodeForSession.mockResolvedValue({ error: null });
  setSession.mockResolvedValue({ error: null });
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
});
