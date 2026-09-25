import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { householdInvites, householdMembers } from "@/lib/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureAuthUserForInvite,
  normalizeInviteEmail,
  sendInviteMagicLink,
} from "./invite-email";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 8;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type MemberRow = {
  userId: string;
  role: "owner" | "member";
  email: string | null;
};

export type InviteRow = {
  id: string;
  code: string;
  invitedEmail: string | null;
  expiresAt: Date;
  useCount: number;
  maxUses: number;
  revokedAt: Date | null;
  createdAt: Date;
};

function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
  }
  return code;
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
}

async function requireOwner(
  householdId: string,
  actorUserId: string,
  action: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ role: householdMembers.role })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, actorUserId),
      ),
    )
    .limit(1);
  if (!row || row.role !== "owner") {
    throw new Error(`Only the household owner can ${action}`);
  }
}

export async function listMembers(householdId: string): Promise<MemberRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: householdMembers.userId,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId));

  // Emails need the service role; missing/failing admin must not 500 /household.
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  const members: MemberRow[] = [];
  for (const row of rows) {
    let email: string | null = null;
    if (admin) {
      try {
        const { data } = await admin.auth.admin.getUserById(row.userId);
        email = data.user?.email ?? null;
      } catch {
        email = null;
      }
    }
    members.push({
      userId: row.userId,
      role: row.role as "owner" | "member",
      email,
    });
  }
  return members;
}

export async function listInvites(householdId: string): Promise<InviteRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: householdInvites.id,
      code: householdInvites.code,
      invitedEmail: householdInvites.invitedEmail,
      expiresAt: householdInvites.expiresAt,
      useCount: householdInvites.useCount,
      maxUses: householdInvites.maxUses,
      revokedAt: householdInvites.revokedAt,
      createdAt: householdInvites.createdAt,
    })
    .from(householdInvites)
    .where(eq(householdInvites.householdId, householdId));

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    invitedEmail: row.invitedEmail,
    expiresAt: new Date(row.expiresAt),
    useCount: row.useCount,
    maxUses: row.maxUses,
    revokedAt: parseTimestamp(row.revokedAt),
    createdAt: new Date(row.createdAt),
  }));
}

export async function createInvite(
  householdId: string,
  createdBy: string,
  email: string,
): Promise<{
  id: string;
  code: string;
  expiresAt: Date;
  joinPath: string;
  emailedTo: string;
}> {
  await requireOwner(householdId, createdBy, "invite");
  const invitedEmail = normalizeInviteEmail(email);
  const { userId: inviteeUserId } = await ensureAuthUserForInvite(invitedEmail);

  const db = getDb();
  const [existingMembership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, inviteeUserId))
    .limit(1);
  if (existingMembership) {
    throw new Error("That person already belongs to a household");
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      const [row] = await db
        .insert(householdInvites)
        .values({
          householdId,
          code,
          createdBy,
          invitedEmail,
          expiresAt: expiresAt.toISOString(),
          maxUses: 1,
          useCount: 0,
        })
        .returning({ id: householdInvites.id });
      if (!row) {
        throw new Error("Failed to create invite");
      }
      const joinPath = `/join?code=${code}`;
      await sendInviteMagicLink(invitedEmail, joinPath);
      return {
        id: row.id,
        code,
        expiresAt,
        joinPath,
        emailedTo: invitedEmail,
      };
    } catch (error) {
      lastError = error;
      // Retry only likely invite-code unique collisions from the insert.
      const message = error instanceof Error ? error.message : String(error);
      if (!/unique|duplicate|household_invites_code/i.test(message)) {
        throw error instanceof Error ? error : new Error(message);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to create invite");
}

export async function resendInvite(
  householdId: string,
  inviteId: string,
  actorUserId: string,
): Promise<{
  id: string;
  code: string;
  expiresAt: Date;
  joinPath: string;
  emailedTo: string;
}> {
  await requireOwner(householdId, actorUserId, "invite");
  const db = getDb();
  const [invite] = await db
    .select({
      id: householdInvites.id,
      code: householdInvites.code,
      invitedEmail: householdInvites.invitedEmail,
      expiresAt: householdInvites.expiresAt,
      useCount: householdInvites.useCount,
      maxUses: householdInvites.maxUses,
      revokedAt: householdInvites.revokedAt,
    })
    .from(householdInvites)
    .where(
      and(
        eq(householdInvites.id, inviteId),
        eq(householdInvites.householdId, householdId),
      ),
    )
    .limit(1);

  if (!invite) {
    throw new Error("Invite not found");
  }
  if (invite.revokedAt) {
    throw new Error("Invite was revoked");
  }
  if (invite.useCount >= invite.maxUses) {
    throw new Error("Invite already used");
  }
  if (!invite.invitedEmail) {
    throw new Error("This invite has no email");
  }

  const invitedEmail = normalizeInviteEmail(invite.invitedEmail);
  await ensureAuthUserForInvite(invitedEmail);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await db
    .update(householdInvites)
    .set({ expiresAt: expiresAt.toISOString() })
    .where(eq(householdInvites.id, invite.id));

  const joinPath = `/join?code=${invite.code}`;
  await sendInviteMagicLink(invitedEmail, joinPath);
  return {
    id: invite.id,
    code: invite.code,
    expiresAt,
    joinPath,
    emailedTo: invitedEmail,
  };
}

export async function revokeInvite(
  householdId: string,
  inviteId: string,
  actorUserId: string,
): Promise<void> {
  await requireOwner(householdId, actorUserId, "revoke invites");

  const db = getDb();
  const updated = await db
    .update(householdInvites)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(
        eq(householdInvites.id, inviteId),
        eq(householdInvites.householdId, householdId),
      ),
    )
    .returning({ id: householdInvites.id });

  if (updated.length === 0) {
    throw new Error("Invite not found");
  }
}

export async function removeMember(
  householdId: string,
  targetUserId: string,
  actorUserId: string,
): Promise<void> {
  await requireOwner(householdId, actorUserId, "remove members");

  const db = getDb();
  const [target] = await db
    .select({
      userId: householdMembers.userId,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, targetUserId),
      ),
    )
    .limit(1);

  if (!target) {
    throw new Error("Member not found");
  }
  if (target.role === "owner") {
    throw new Error("Cannot remove the household owner");
  }

  await db
    .delete(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, targetUserId),
      ),
    );
}

/**
 * After magic-link sign-in, join the newest valid invite for this email.
 * Returns null when there is nothing pending (caller continues to setup/home).
 */
export async function acceptPendingInviteForUser(
  userId: string,
  email: string,
): Promise<{ householdId: string } | null> {
  const acceptorEmail = normalizeInviteEmail(email);
  const db = getDb();

  const [existing] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .limit(1);
  if (existing) {
    return { householdId: existing.householdId };
  }

  const candidates = await db
    .select({
      code: householdInvites.code,
      invitedEmail: householdInvites.invitedEmail,
      revokedAt: householdInvites.revokedAt,
      expiresAt: householdInvites.expiresAt,
      useCount: householdInvites.useCount,
      maxUses: householdInvites.maxUses,
    })
    .from(householdInvites)
    .where(eq(householdInvites.invitedEmail, acceptorEmail))
    .orderBy(desc(householdInvites.createdAt));

  for (const invite of candidates) {
    if (!invite.invitedEmail) continue;
    if (invite.revokedAt) continue;
    if (new Date(invite.expiresAt).getTime() <= Date.now()) continue;
    if (invite.useCount >= invite.maxUses) continue;
    try {
      return await acceptInvite(invite.code, userId, acceptorEmail);
    } catch {
      // Try older invites if this one raced or failed.
    }
  }
  return null;
}

export async function acceptInvite(
  code: string,
  userId: string,
  email: string,
): Promise<{ householdId: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Invalid invite code");
  }
  const acceptorEmail = normalizeInviteEmail(email);

  const db = getDb();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);
    if (existing) {
      throw new Error("You already belong to a household");
    }

    const [invite] = await tx
      .select()
      .from(householdInvites)
      .where(eq(householdInvites.code, normalized))
      .limit(1)
      .for("update");

    if (!invite) {
      throw new Error("Invalid invite code");
    }
    if (!invite.invitedEmail) {
      throw new Error("Invite expired; request a new one");
    }
    if (normalizeInviteEmail(invite.invitedEmail) !== acceptorEmail) {
      throw new Error(
        "This invite was sent to a different email. Sign in with the invited address or ask for a new invite.",
      );
    }
    if (invite.revokedAt) {
      throw new Error("Invite revoked");
    }
    if (new Date(invite.expiresAt).getTime() <= Date.now()) {
      throw new Error("Invite expired");
    }
    if (invite.useCount >= invite.maxUses) {
      throw new Error("Invite has already been used");
    }

    await tx.insert(householdMembers).values({
      householdId: invite.householdId,
      userId,
      role: "member",
    });

    const claimed = await tx
      .update(householdInvites)
      .set({ useCount: sql`${householdInvites.useCount} + 1` })
      .where(
        and(
          eq(householdInvites.id, invite.id),
          sql`${householdInvites.useCount} < ${householdInvites.maxUses}`,
        ),
      )
      .returning({ id: householdInvites.id });
    if (claimed.length === 0) {
      throw new Error("Invite has already been used");
    }

    return { householdId: invite.householdId };
  });
}
