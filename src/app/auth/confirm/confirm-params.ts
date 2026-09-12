import { parseConfirmOtpType, type ConfirmOtpType } from "./otp-type";

export type ConfirmAuth =
  | { kind: "token"; token_hash: string; type: ConfirmOtpType }
  | { kind: "code"; code: string }
  | { kind: "invalid" };

/** Resolve PKCE email links: token_hash templates or ConfirmationURL ?code= redirects. */
export function resolveConfirmAuth(searchParams: URLSearchParams): ConfirmAuth {
  const token_hash = searchParams.get("token_hash");
  const type = parseConfirmOtpType(searchParams.get("type"));
  if (token_hash && type) {
    return { kind: "token", token_hash, type };
  }
  const code = searchParams.get("code");
  if (code) {
    return { kind: "code", code };
  }
  return { kind: "invalid" };
}
