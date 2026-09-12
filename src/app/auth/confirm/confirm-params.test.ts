import { describe, expect, it } from "vitest";
import { resolveConfirmAuth } from "./confirm-params";

describe("resolveConfirmAuth", () => {
  it("prefers token_hash + type for PKCE email templates", () => {
    const params = new URLSearchParams({
      token_hash: "abc",
      type: "invite",
      code: "should-ignore",
    });
    expect(resolveConfirmAuth(params)).toEqual({
      kind: "token",
      token_hash: "abc",
      type: "invite",
    });
  });

  it("accepts ConfirmationURL PKCE redirects with code only", () => {
    expect(resolveConfirmAuth(new URLSearchParams({ code: "pkce-code" }))).toEqual({
      kind: "code",
      code: "pkce-code",
    });
  });

  it("rejects missing or unknown type without a code", () => {
    expect(resolveConfirmAuth(new URLSearchParams({ token_hash: "abc" }))).toEqual({
      kind: "invalid",
    });
    expect(
      resolveConfirmAuth(new URLSearchParams({ token_hash: "abc", type: "signup" })),
    ).toEqual({ kind: "invalid" });
    expect(resolveConfirmAuth(new URLSearchParams())).toEqual({ kind: "invalid" });
  });
});
