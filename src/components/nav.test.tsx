// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Nav } from "./nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("./generation-provider", () => ({
  useGeneration: () => ({
    state: { status: "idle" },
    cancel: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

describe("Nav", () => {
  afterEach(cleanup);

  it("hides Developer when developerTools is false", () => {
    render(<Nav developerTools={false} userEmail="alex@example.com" />);
    expect(screen.queryByRole("link", { name: "Developer" })).toBeNull();
    expect(screen.getByRole("link", { name: "Plans" }).getAttribute("href")).toBe(
      "/",
    );
    expect(screen.getByRole("link", { name: "Meals" }).getAttribute("href")).toBe(
      "/meals",
    );
  });

  it("shows a Developer link to /developer when developerTools is true", () => {
    render(<Nav developerTools={true} userEmail="alex@example.com" />);
    const link = screen.getByRole("link", { name: "Developer" });
    expect(link.getAttribute("href")).toBe("/developer");
  });

  it("shows email and a logout form", () => {
    render(<Nav developerTools={false} userEmail="alex@example.com" />);
    expect(screen.getByText("alex@example.com")).toBeTruthy();
    const form = screen.getByRole("button", { name: "Log out" }).closest("form");
    expect(form?.getAttribute("action")).toBe("/logout");
    expect(form?.getAttribute("method")).toBe("post");
  });
});
