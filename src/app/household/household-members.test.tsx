// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const createInviteAction = vi.fn();
const revokeInviteAction = vi.fn();
const removeMemberAction = vi.fn();
const refresh = vi.fn();

vi.mock("./actions", () => ({
  createInviteAction: (...args: unknown[]) => createInviteAction(...args),
  revokeInviteAction: (...args: unknown[]) => revokeInviteAction(...args),
  removeMemberAction: (...args: unknown[]) => removeMemberAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { HouseholdMembers } from "./household-members";

afterEach(() => {
  cleanup();
  createInviteAction.mockReset();
  revokeInviteAction.mockReset();
  removeMemberAction.mockReset();
  refresh.mockReset();
});

const members = [
  {
    userId: "owner-1",
    role: "owner" as const,
    email: "owner@example.com",
  },
  {
    userId: "member-1",
    role: "member" as const,
    email: "member@example.com",
  },
];

describe("HouseholdMembers", () => {
  it("lists emails and roles; owner invites by email", async () => {
    createInviteAction.mockResolvedValue({
      ok: true,
      id: "inv-1",
      code: "ABCD2345",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      joinPath: "/join?code=ABCD2345",
      emailedTo: "partner@example.com",
    });

    render(
      <HouseholdMembers
        members={members}
        invites={[]}
        isOwner
        currentUserId="owner-1"
      />,
    );

    expect(screen.getByText(/household members/i)).toBeTruthy();
    expect(screen.getByText(/owner@example.com/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /send invite/i })).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/invite by email/i), {
      target: { value: "partner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() => {
      expect(createInviteAction).toHaveBeenCalledWith("partner@example.com");
      expect(screen.getByText(/invite sent to/i)).toBeTruthy();
      expect(screen.getByDisplayValue(/\/join\?code=ABCD2345/)).toBeTruthy();
    });
  });

  it("hides invite/remove controls for non-owners", () => {
    render(
      <HouseholdMembers
        members={members}
        invites={[]}
        isOwner={false}
        currentUserId="member-1"
      />,
    );
    expect(screen.queryByRole("button", { name: /send invite/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^remove$/i })).toBeNull();
    expect(
      screen.getByText(/only the household owner can invite/i),
    ).toBeTruthy();
  });
});
