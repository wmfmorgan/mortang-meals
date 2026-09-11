import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims },
  }),
}));

import { updateSession } from "./middleware";

function requestFor(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("updateSession", () => {
  beforeEach(() => {
    getClaims.mockReset();
    getClaims.mockResolvedValue({ data: { claims: null } });
  });

  it("redirects to /login when getClaims is empty and path is /", async () => {
    const response = await updateSession(requestFor("/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });

  it("does not redirect /login when getClaims is empty", async () => {
    const response = await updateSession(requestFor("/login"));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect /auth/confirm or /logout when getClaims is empty", async () => {
    const confirm = await updateSession(requestFor("/auth/confirm"));
    expect(confirm.status).not.toBe(307);
    expect(confirm.headers.get("location")).toBeNull();

    const logout = await updateSession(requestFor("/logout"));
    expect(logout.status).not.toBe(307);
    expect(logout.headers.get("location")).toBeNull();
  });

  it("does not redirect / when getClaims returns a user", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: "user-1" } } });
    const response = await updateSession(requestFor("/"));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect unauthenticated /api/* so handlers can return 401", async () => {
    const response = await updateSession(requestFor("/api/generate"));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });
});
