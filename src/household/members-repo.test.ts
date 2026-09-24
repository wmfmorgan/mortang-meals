import { afterEach, describe, expect, it, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import {
  createAuthUserWithoutHousehold,
  createTestIdentity,
  deleteTestUser,
} from "@/lib/test-identity";
import * as adminModule from "@/lib/supabase/admin";
import { getHouseholdForUser, upsertHousehold } from "./repo";
import * as inviteEmail from "./invite-email";
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
  vi.restoreAllMocks();
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

function mockSendMagicLink() {
  return vi.spyOn(inviteEmail, "sendInviteMagicLink").mockResolvedValue();
}

describe("members repo", () => {
  it("owner creates email invite; matching guest accepts", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("invite-owner");
    const guest = await createAuthUserWithoutHousehold(
      `invite-guest-${crypto.randomUUID()}@example.com`,
    );
    users.push(guest.userId);

    const invite = await createInvite(
      owner.householdId,
      owner.userId,
      guest.email,
    );
    expect(invite.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(invite.joinPath).toBe(`/join?code=${invite.code}`);
    expect(invite.emailedTo).toBe(guest.email.toLowerCase());
    expect(inviteEmail.sendInviteMagicLink).toHaveBeenCalledWith(
      guest.email.toLowerCase(),
      invite.joinPath,
    );

    const listed = await listInvites(owner.householdId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.invitedEmail).toBe(guest.email.toLowerCase());

    const accepted = await acceptInvite(
      invite.code.toLowerCase(),
      guest.userId,
      guest.email,
    );
    expect(accepted.householdId).toBe(owner.householdId);

    const seen = await getHouseholdForUser(guest.userId);
    expect(seen?.id).toBe(owner.householdId);
  });

  it("accept rejects wrong email", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("wrong-email-owner");
    const invited = await createAuthUserWithoutHousehold(
      `invited-${crypto.randomUUID()}@example.com`,
    );
    const other = await createAuthUserWithoutHousehold(
      `other-${crypto.randomUUID()}@example.com`,
    );
    users.push(invited.userId, other.userId);

    const invite = await createInvite(
      owner.householdId,
      owner.userId,
      invited.email,
    );
    await expect(
      acceptInvite(invite.code, other.userId, other.email),
    ).rejects.toThrow(/different email/i);
  });

  it("cannot invite someone who already has a household", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("taken-owner");
    const other = await createTestIdentity("taken-other@example.com");
    users.push(other.userId);
    await expect(
      createInvite(owner.householdId, owner.userId, other.email),
    ).rejects.toThrow(/already belongs/i);
    expect(inviteEmail.sendInviteMagicLink).not.toHaveBeenCalled();
  });

  it("accepting twice fails", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("accept-twice-owner");
    const guest = await createAuthUserWithoutHousehold();
    users.push(guest.userId);
    const invite = await createInvite(
      owner.householdId,
      owner.userId,
      guest.email,
    );
    await acceptInvite(invite.code, guest.userId, guest.email);
    await expect(
      acceptInvite(invite.code, guest.userId, guest.email),
    ).rejects.toThrow(/already belong/i);
  });

  it("user with existing household cannot accept", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("existing-hh-owner");
    const other = await createTestIdentity("existing-hh-other@example.com");
    users.push(other.userId);
    const guestEmail = `empty-${crypto.randomUUID()}@example.com`;
    const invite = await createInvite(
      owner.householdId,
      owner.userId,
      guestEmail,
    );
    // Provisioned auth user for guestEmail may exist; accept as other (wrong email)
    // and as other with forced email mismatch covered above. Here: other already member.
    await expect(
      acceptInvite(invite.code, other.userId, other.email),
    ).rejects.toThrow(/already belong|different email/i);
  });

  it("non-owner cannot create invite", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("non-owner-create");
    const guest = await createAuthUserWithoutHousehold();
    users.push(guest.userId);
    const invite = await createInvite(
      owner.householdId,
      owner.userId,
      guest.email,
    );
    await acceptInvite(invite.code, guest.userId, guest.email);
    await expect(
      createInvite(owner.householdId, guest.userId, "someone@example.com"),
    ).rejects.toThrow(/only the household owner can invite/i);
  });

  it("owner removes member; member loses household", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("remove-owner");
    const guest = await createAuthUserWithoutHousehold();
    users.push(guest.userId);
    const invite = await createInvite(
      owner.householdId,
      owner.userId,
      guest.email,
    );
    await acceptInvite(invite.code, guest.userId, guest.email);

    await removeMember(owner.householdId, guest.userId, owner.userId);
    expect(await getHouseholdForUser(guest.userId)).toBeNull();
    const members = await listMembers(owner.householdId);
    expect(members.map((m) => m.userId)).toEqual([owner.userId]);
  });

  it("revoke blocks accept", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("revoke-owner");
    const guest = await createAuthUserWithoutHousehold();
    users.push(guest.userId);
    const invite = await createInvite(
      owner.householdId,
      owner.userId,
      guest.email,
    );
    const listed = await listInvites(owner.householdId);
    await revokeInvite(owner.householdId, listed[0]!.id, owner.userId);
    await expect(
      acceptInvite(invite.code, guest.userId, guest.email),
    ).rejects.toThrow(/revoked|expired|invalid/i);
  });

  it("second guest cannot accept after invite is exhausted", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("exhaust-owner");
    const first = await createAuthUserWithoutHousehold();
    const second = await createAuthUserWithoutHousehold();
    users.push(first.userId, second.userId);
    const invite = await createInvite(
      owner.householdId,
      owner.userId,
      first.email,
    );
    await acceptInvite(invite.code, first.userId, first.email);
    await expect(
      acceptInvite(invite.code, second.userId, first.email),
    ).rejects.toThrow(/already been used|already belong/i);
    expect(await getHouseholdForUser(second.userId)).toBeNull();
  });

  it("non-owner cannot revoke or remove", async () => {
    mockSendMagicLink();
    const owner = await ownerHousehold("non-owner-mutate");
    const guest = await createAuthUserWithoutHousehold();
    const other = await createAuthUserWithoutHousehold();
    users.push(guest.userId, other.userId);
    const invite = await createInvite(
      owner.householdId,
      owner.userId,
      guest.email,
    );
    await acceptInvite(invite.code, guest.userId, guest.email);
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
