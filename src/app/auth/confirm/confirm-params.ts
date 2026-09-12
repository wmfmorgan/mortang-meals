import { parseConfirmOtpType, type ConfirmOtpType } from "./otp-type";

export type ConfirmAuth =
  | { kind: "token"; token_hash: string; type: ConfirmOtpType }
  | { kind: "code"; code: string }
  | { kind: "implicit"; access_token: string; refresh_token: string }
  | { kind: "invalid" };

/** Resolve query-string auth links (token_hash templates or ConfirmationURL ?code=). */
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

/**
 * Resolve whatever the default Supabase ConfirmationURL left in the browser:
 * query params, or implicit-flow hash fragments (#access_token=...).
 */
export function resolveBrowserConfirmAuth(
  search: string,
  hash: string,
): ConfirmAuth {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const fromQuery = resolveConfirmAuth(new URLSearchParams(query));
  if (fromQuery.kind !== "invalid") return fromQuery;

  const hashQuery = hash.startsWith("#") ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(hashQuery);
  const access_token = hashParams.get("access_token");
  const refresh_token = hashParams.get("refresh_token");
  if (access_token && refresh_token) {
    return { kind: "implicit", access_token, refresh_token };
  }
  const code = hashParams.get("code");
  if (code) return { kind: "code", code };
  return { kind: "invalid" };
}
