import { afterEach, describe, expect, it, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import {
  createAuthUserWithoutHousehold,
  createTestIdentity,
  deleteTestUser,
} from "@/lib/test-identity";
import * as adminModule from "@/lib/supabase/admin";
import { getHouseholdForUser, upsertHousehold } from "./repo";
import {
  acceptInvite,
  createInvite,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
} from "./members-repo";

const users: string[] = [];
afterEach(async () => {
  await resetDbForTests();
  await Promise.all(users.splice(0).map(deleteTestUser));
});

async function ownerHousehold(emailPrefix: string) {
  const owner = await createTestIdentity(`${emailPrefix}@example.com`);
  users.push(owner.userId);
  await upsertHousehold({
    ownerId: owner.userId,
    id: owner.householdId,
    name: "Shared",
    dietStyle: "omnivore",
    notes: "",
    servings: 2,
  });
  return owner;
}

describe("members repo", () => {
  it("owner creates invite; second user accepts; getHouseholdForUser matches", async () => {
    const owner = await ownerHousehold("invite-owner");
    const guest = await createAuthUserWithoutHousehold(
      `invite-guest-${crypto.randomUUID()}@example.com`,
    );
    users.push(guest.userId);

    const invite = await createInvite(owner.householdId, owner.userId);
    expect(invite.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(invite.joinPath).toBe(`/join?code=${invite.code}`);
    expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const listed = await listInvites(owner.householdId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.code).toBe(invite.code);

    const accepted = await acceptInvite(invite.code.toLowerCase(), guest.userId);
    expect(accepted.householdId).toBe(owner.householdId);

    const seen = await getHouseholdForUser(guest.userId);
    expect(seen?.id).toBe(owner.householdId);
    expect(seen?.name).toBe("Shared");

    const members = await listMembers(owner.householdId);
    expect(members.map((m) => m.userId).sort()).toEqual(
      [owner.userId, guest.userId].sort(),
    );
    expect(members.find((m) => m.userId === guest.userId)?.role).toBe("member");
    expect(members.find((m) => m.userId === owner.userId)?.email).toContain(
      "invite-owner",
    );
  });

  it("accepting twice fails", async () => {
    const owner = await ownerHousehold("accept-twice-owner");
    const guest = await createAuthUserWithoutHousehold();
    users.push(guest.userId);
    const invite = await createInvite(owner.householdId, owner.userId);
    await acceptInvite(invite.code, guest.userId);
    await expect(acceptInvite(invite.code, guest.userId)).rejects.toThrow(
      /already belong/i,
    );
  });

  it("user with existing household cannot accept", async () => {
    const owner = await ownerHousehold("existing-hh-owner");
    const other = await createTestIdentity("existing-hh-other@example.com");
    users.push(other.userId);
    const invite = await createInvite(owner.householdId, owner.userId);
    await expect(acceptInvite(invite.code, other.userId)).rejects.toThrow(
      /already belong/i,
    );
  });

  it("non-owner cannot create invite", async () => {
    const owner = await ownerHousehold("non-owner-create");
    const guest = await createAuthUserWithoutHousehold();
    users.push(guest.userId);
    const invite = await createInvite(owner.householdId, owner.userId);
    await acceptInvite(invite.code, guest.userId);
    await expect(createInvite(owner.householdId, guest.userId)).rejects.toThrow(
      /only the household owner can invite/i,
    );
  });

  it("owner removes member; member loses household", async () => {
    const owner = await ownerHousehold("remove-owner");
    const guest = await createAuthUserWithoutHousehold();
    users.push(guest.userId);
    const invite = await createInvite(owner.householdId, owner.userId);
    await acceptInvite(invite.code, guest.userId);

    await removeMember(owner.householdId, guest.userId, owner.userId);
    expect(await getHouseholdForUser(guest.userId)).toBeNull();
    const members = await listMembers(owner.householdId);
    expect(members.map((m) => m.userId)).toEqual([owner.userId]);
  });

  it("revoke blocks accept", async () => {
    const owner = await ownerHousehold("revoke-owner");
    const guest = await createAuthUserWithoutHousehold();
    users.push(guest.userId);
    const invite = await createInvite(owner.householdId, owner.userId);
    const listed = await listInvites(owner.householdId);
    await revokeInvite(owner.householdId, listed[0]!.id, owner.userId);
    await expect(acceptInvite(invite.code, guest.userId)).rejects.toThrow(
      /revoked|expired|invalid/i,
    );
  });

  it("second guest cannot accept after invite is exhausted", async () => {
    const owner = await ownerHousehold("exhaust-owner");
    const first = await createAuthUserWithoutHousehold();
    const second = await createAuthUserWithoutHousehold();
    users.push(first.userId, second.userId);
    const invite = await createInvite(owner.householdId, owner.userId);
    await acceptInvite(invite.code, first.userId);
    await expect(acceptInvite(invite.code, second.userId)).rejects.toThrow(
      /already been used/i,
    );
    expect(await getHouseholdForUser(second.userId)).toBeNull();
  });

  it("non-owner cannot revoke or remove", async () => {
    const owner = await ownerHousehold("non-owner-mutate");
    const guest = await createAuthUserWithoutHousehold();
    const other = await createAuthUserWithoutHousehold();
    users.push(guest.userId, other.userId);
    const invite = await createInvite(owner.householdId, owner.userId);
    await acceptInvite(invite.code, guest.userId);
    const listed = await listInvites(owner.householdId);
    await expect(
      revokeInvite(owner.householdId, listed[0]!.id, guest.userId),
    ).rejects.toThrow(/only the household owner/i);
    await expect(
      removeMember(owner.householdId, guest.userId, guest.userId),
    ).rejects.toThrow(/only the household owner/i);
  });

  it("listMembers soft-fails when service role client is unavailable", async () => {
    const owner = await ownerHousehold("soft-fail-admin");
    const spy = vi.spyOn(adminModule, "createAdminClient").mockImplementation(() => {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
      );
    });
    try {
      const members = await listMembers(owner.householdId);
      expect(members).toEqual([
        { userId: owner.userId, role: "owner", email: null },
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it("listMembers soft-fails when getUserById throws", async () => {
    const owner = await ownerHousehold("soft-fail-lookup");
    const spy = vi.spyOn(adminModule, "createAdminClient").mockReturnValue({
      auth: {
        admin: {
          getUserById: async () => {
            throw new Error("admin lookup failed");
          },
        },
      },
    } as ReturnType<typeof adminModule.createAdminClient>);
    try {
      const members = await listMembers(owner.householdId);
      expect(members).toEqual([
        { userId: owner.userId, role: "owner", email: null },
      ]);
    } finally {
      spy.mockRestore();
    }
  });
});
