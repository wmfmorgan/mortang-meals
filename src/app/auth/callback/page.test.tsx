// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

import CallbackPage from "./page";

describe("auth callback landing", () => {
  it("asks the user to continue and does not consume the OTP on GET", async () => {
    const page = await CallbackPage({
      searchParams: Promise.resolve({
        token_hash: "abc",
        type: "email",
        next: "/join?code=9J4BRLZZ",
      }),
    });
    render(page);
    expect(
      screen.getByRole("button", { name: /continue signing in/i }),
    ).toBeTruthy();
    const form = screen.getByRole("button", { name: /continue signing in/i })
      .closest("form");
    expect(form?.getAttribute("action")).toBe("/auth/callback/complete");
    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
