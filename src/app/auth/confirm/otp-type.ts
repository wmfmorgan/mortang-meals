export const CONFIRM_OTP_TYPES = ["email", "invite", "magiclink"] as const;

export type ConfirmOtpType = (typeof CONFIRM_OTP_TYPES)[number];

export function parseConfirmOtpType(
  type: string | null,
): ConfirmOtpType | null {
  if (type === "email" || type === "invite" || type === "magiclink") {
    return type;
  }
  return null;
}
