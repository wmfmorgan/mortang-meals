import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();
const getClaims = vi.fn();
const exchangeCodeForSession = vi.fn();
const acceptPendingInviteForUser = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { verifyOtp, getClaims, exchangeCodeForSession },
  }),
}));

vi.mock("@/household/members-repo", () => ({
  acceptPendingInviteForUser: (...args: unknown[]) =>
    acceptPendingInviteForUser(...args),
}));

import { POST } from "./route";

function postForm(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return new Request("http://localhost:3000/auth/callback/complete", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("POST /auth/callback/complete", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    getClaims.mockReset();
    exchangeCodeForSession.mockReset();
    acceptPendingInviteForUser.mockReset();
    redirect.mockClear();
    verifyOtp.mockResolvedValue({ error: null });
    getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", email: "guest@example.com" } },
    });
    acceptPendingInviteForUser.mockResolvedValue({ householdId: "hh-1" });
  });

  it("verifies the OTP on POST and joins a pending invite", async () => {
    await expect(
      POST(
        postForm({
          token_hash: "abc",
          type: "email",
          next: "/join?code=9J4BRLZZ",
        }) as never,
      ),
    ).rejects.toThrow("REDIRECT:/");
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "email",
      token_hash: "abc",
    });
    expect(acceptPendingInviteForUser).toHaveBeenCalledWith(
      "user-1",
      "guest@example.com",
    );
  });
});
