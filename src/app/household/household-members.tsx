"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MemberRow } from "@/household/members-repo";
import { publicAppOrigin } from "@/lib/public-app-origin";
import {
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
} from "./actions";

export type SerializableInvite = {
  id: string;
  code: string;
  invitedEmail: string | null;
  expiresAt: string;
  useCount: number;
  maxUses: number;
  revokedAt: string | null;
  createdAt: string;
};

export type HouseholdMembersProps = {
  members: MemberRow[];
  invites: SerializableInvite[];
  isOwner: boolean;
  currentUserId: string;
};

function inviteActive(invite: SerializableInvite): boolean {
  return (
    !invite.revokedAt &&
    invite.useCount < invite.maxUses &&
    new Date(invite.expiresAt).getTime() > Date.now()
  );
}

export function HouseholdMembers({
  members,
  invites: initialInvites,
  isOwner,
  currentUserId,
}: HouseholdMembersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [created, setCreated] = useState<{
    code: string;
    joinUrl: string;
    emailedTo: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [invites, setInvites] = useState(initialInvites);

  const activeInvites = useMemo(
    () => invites.filter(inviteActive),
    [invites],
  );

  function refresh() {
    router.refresh();
  }

  function onInvite() {
    setError(null);
    setCopied(false);
    const email = inviteEmail.trim();
    if (!email) {
      setError("Enter an email address.");
      return;
    }
    startTransition(async () => {
      const result = await createInviteAction(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const origin =
        publicAppOrigin(window.location.origin) || window.location.origin;
      const joinUrl = `${origin}${result.joinPath}`;
      setCreated({
        code: result.code,
        joinUrl,
        emailedTo: result.emailedTo,
      });
      setInviteEmail("");
      setInvites((current) => [
        {
          id: result.id,
          code: result.code,
          invitedEmail: result.emailedTo,
          expiresAt: result.expiresAt,
          useCount: 0,
          maxUses: 1,
          revokedAt: null,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      refresh();
    });
  }

  function onRevoke(inviteId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeInviteAction(inviteId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const revoked = invites.find((invite) => invite.id === inviteId);
      setInvites((current) =>
        current.map((invite) =>
          invite.id === inviteId
            ? { ...invite, revokedAt: new Date().toISOString() }
            : invite,
        ),
      );
      if (created && revoked && revoked.code === created.code) {
        setCreated(null);
      }
      refresh();
    });
  }

  function onRemove(userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      refresh();
    });
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.joinUrl);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Couldn’t copy link. Select it and copy manually.");
    }
  }

  return (
    <section className="surface mx-auto max-w-3xl space-y-4 p-5">
      <div>
        <h2 className="m-0 text-xl font-medium tracking-[-0.03em]">
          Household members
        </h2>
        <p className="mt-1 mb-0 text-sm text-herb">
          Everyone here shares Plans, Meals, and the shopping list.
        </p>
      </div>

      {error ? (
        <p role="alert" className="alert m-0">
          {error}
        </p>
      ) : null}

      <ul className="m-0 list-none space-y-2 p-0">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-wheat/80 bg-paper px-3 py-2"
          >
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-medium">
                {member.email ?? "Unknown email"}
                {member.userId === currentUserId ? " (you)" : ""}
              </p>
              <p className="m-0 text-xs uppercase tracking-[0.06em] text-herb">
                {member.role}
              </p>
            </div>
            {isOwner && member.role !== "owner" ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pending}
                onClick={() => onRemove(member.userId)}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <div className="space-y-3 border-t border-wheat/70 pt-4">
          <label className="field">
            Invite by email
            <input
              className="input"
              type="email"
              name="inviteEmail"
              autoComplete="email"
              placeholder="partner@example.com"
              value={inviteEmail}
              disabled={pending}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={onInvite}
          >
            {pending && !created ? "Sending…" : "Send invite"}
          </button>

          {created ? (
            <div className="space-y-2 rounded-xl border border-wheat/80 bg-linen/40 p-3">
              <p className="m-0 text-sm">
                Invite sent to <strong>{created.emailedTo}</strong>. They can
                open the magic link in their email, or use this backup code.
              </p>
              <p className="m-0 text-sm">
                Invite code:{" "}
                <span className="font-mono text-base tracking-wider">
                  {created.code}
                </span>
              </p>
              <label className="field">
                Join link
                <input
                  className="input"
                  readOnly
                  value={created.joinUrl}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void copyLink()}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : null}

          {activeInvites.length > 0 ? (
            <div className="space-y-2">
              <h3 className="m-0 text-sm font-medium">Active invites</h3>
              <ul className="m-0 list-none space-y-2 p-0">
                {activeInvites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-wheat/80 px-3 py-2"
                  >
                    <div>
                      <p className="m-0 font-mono text-sm tracking-wider">
                        {invite.code}
                      </p>
                      {invite.invitedEmail ? (
                        <p className="m-0 text-xs text-herb">
                          {invite.invitedEmail}
                        </p>
                      ) : null}
                      <p className="m-0 text-xs text-herb">
                        Expires{" "}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={pending}
                      onClick={() => onRevoke(invite.id)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="m-0 text-sm text-herb">
          Only the household owner can invite or remove people.
        </p>
      )}
    </section>
  );
}
