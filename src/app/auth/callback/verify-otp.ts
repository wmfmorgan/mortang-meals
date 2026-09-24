import type { ConfirmOtpType } from "@/app/auth/confirm/otp-type";

const FALLBACK_TYPES: ConfirmOtpType[] = ["email", "magiclink", "invite"];

type VerifyOtp = (input: {
  type: ConfirmOtpType;
  token_hash: string;
}) => Promise<{ error: { message: string } | null }>;

export async function verifyTokenHash(
  verifyOtp: VerifyOtp,
  token_hash: string,
  type: ConfirmOtpType,
): Promise<{ message: string } | null> {
  const order = [type, ...FALLBACK_TYPES.filter((candidate) => candidate !== type)];
  let lastError: { message: string } | null = null;
  for (const candidate of order) {
    const { error } = await verifyOtp({ type: candidate, token_hash });
    if (!error) return null;
    lastError = error;
  }
  return lastError;
}
