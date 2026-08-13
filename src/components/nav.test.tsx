// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Nav } from "./nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Nav", () => {
  it("hides Developer when developerTools is false", () => {
    render(<Nav developerTools={false} />);
    expect(screen.queryByRole("link", { name: "Developer" })).toBeNull();
  });

  it("shows a Developer link to /developer when developerTools is true", () => {
    render(<Nav developerTools={true} />);
    const link = screen.getByRole("link", { name: "Developer" });
    expect(link.getAttribute("href")).toBe("/developer");
  });
});
