import { describe, expect, it } from "vitest";
import { parseConfirmOtpType } from "./otp-type";

describe("parseConfirmOtpType", () => {
  it("accepts email, invite, and magiclink", () => {
    expect(parseConfirmOtpType("email")).toBe("email");
    expect(parseConfirmOtpType("invite")).toBe("invite");
    expect(parseConfirmOtpType("magiclink")).toBe("magiclink");
  });

  it("rejects missing and other OTP types", () => {
    expect(parseConfirmOtpType(null)).toBeNull();
    expect(parseConfirmOtpType("")).toBeNull();
    expect(parseConfirmOtpType("signup")).toBeNull();
    expect(parseConfirmOtpType("recovery")).toBeNull();
    expect(parseConfirmOtpType("email_change")).toBeNull();
  });
});
