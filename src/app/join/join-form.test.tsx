// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const acceptInviteAction = vi.fn();
const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/household/actions", () => ({
  acceptInviteAction: (...args: unknown[]) => acceptInviteAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

import { JoinForm } from "./join-form";

afterEach(() => {
  cleanup();
  acceptInviteAction.mockReset();
  replace.mockReset();
  refresh.mockReset();
});

describe("JoinForm", () => {
  it("prefills code from initialCode and accepts", async () => {
    acceptInviteAction.mockResolvedValue({ ok: true });
    render(<JoinForm initialCode="ab12cd34" />);
    const input = screen.getByLabelText(/invite code/i) as HTMLInputElement;
    expect(input.value).toBe("AB12CD34");

    fireEvent.click(screen.getByRole("button", { name: /accept invite/i }));

    await waitFor(() => {
      expect(acceptInviteAction).toHaveBeenCalledWith("AB12CD34");
      expect(replace).toHaveBeenCalledWith("/");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("shows repo error without navigating", async () => {
    acceptInviteAction.mockResolvedValue({
      ok: false,
      error: "Invite expired",
    });
    render(<JoinForm />);
    fireEvent.change(screen.getByLabelText(/invite code/i), {
      target: { value: "ZZZZZZZZ" },
    });
    fireEvent.click(screen.getByRole("button", { name: /accept invite/i }));

    await waitFor(() => {
      expect(screen.getByText(/invite expired/i)).toBeTruthy();
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("requires a code", async () => {
    render(<JoinForm />);
    fireEvent.click(screen.getByRole("button", { name: /accept invite/i }));
    await waitFor(() => {
      expect(screen.getByText(/enter an invite code/i)).toBeTruthy();
    });
    expect(acceptInviteAction).not.toHaveBeenCalled();
  });
});
