import { describe, expect, it, vi } from "vitest";
import { verifyTokenHash } from "./verify-otp";

describe("verifyTokenHash", () => {
  it("returns null on the first successful type", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    const error = await verifyTokenHash(verifyOtp, "hash", "email");
    expect(error).toBeNull();
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "hash" });
  });

  it("falls back from invite to email when the template type does not match the OTP", async () => {
    const verifyOtp = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "Token has expired or is invalid" } })
      .mockResolvedValueOnce({ error: null });
    const error = await verifyTokenHash(verifyOtp, "hash", "invite");
    expect(error).toBeNull();
    expect(verifyOtp).toHaveBeenNthCalledWith(1, {
      type: "invite",
      token_hash: "hash",
    });
    expect(verifyOtp).toHaveBeenNthCalledWith(2, {
      type: "email",
      token_hash: "hash",
    });
  });
});
