import { afterEach, describe, expect, it } from "vitest";
import { publicAppOrigin } from "./public-app-origin";

const original = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe("publicAppOrigin", () => {
  it("prefers NEXT_PUBLIC_SITE_URL over the browser origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.mortang.com/";
    expect(publicAppOrigin("https://mortang-meals-team.vercel.app")).toBe(
      "https://www.mortang.com",
    );
  });

  it("falls back to the browser origin when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(publicAppOrigin("https://localhost:3000")).toBe("https://localhost:3000");
  });
});
