import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { householdInvites, householdMembers } from "@/lib/schema";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();
  const members: MemberRow[] = [];
  for (const row of rows) {
    const { data } = await admin.auth.admin.getUserById(row.userId);
    members.push({
      userId: row.userId,
      role: row.role as "owner" | "member",
      email: data.user?.email ?? null,
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
): Promise<{ code: string; expiresAt: Date; joinPath: string }> {
  await requireOwner(householdId, createdBy, "invite");

  const db = getDb();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      await db.insert(householdInvites).values({
        householdId,
        code,
        createdBy,
        expiresAt: expiresAt.toISOString(),
        maxUses: 1,
        useCount: 0,
      });
      return {
        code,
        expiresAt,
        joinPath: `/join?code=${code}`,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to create invite");
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

export async function acceptInvite(
  code: string,
  userId: string,
): Promise<{ householdId: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Invalid invite code");
  }

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
      .limit(1);

    if (!invite) {
      throw new Error("Invalid invite code");
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

    await tx
      .update(householdInvites)
      .set({ useCount: sql`${householdInvites.useCount} + 1` })
      .where(eq(householdInvites.id, invite.id));

    return { householdId: invite.householdId };
  });
}
