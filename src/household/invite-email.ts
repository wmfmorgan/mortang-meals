import { publicAppOrigin } from "@/lib/public-app-origin";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInviteEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !EMAIL_RE.test(normalized)) {
    throw new Error("Enter a valid email address");
  }
  return normalized;
}

/** Create confirmed Auth user or return existing id for that email. */
export async function ensureAuthUserForInvite(
  email: string,
): Promise<{ userId: string }> {
  const normalized = normalizeInviteEmail(email);
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
  });
  if (data.user?.id) {
    return { userId: data.user.id };
  }

  const message = error?.message ?? "";
  if (!/already|registered|exists/i.test(message)) {
    throw new Error(error?.message ?? "Couldn’t create invitee account");
  }

  // Prefer email filter when the Admin API supports it; fall back to scan.
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) {
    throw new Error(listed.error.message);
  }
  const found = listed.data.users.find(
    (user) => (user.email ?? "").toLowerCase() === normalized,
  );
  if (!found) {
    throw new Error("Couldn’t find invitee account");
  }
  return { userId: found.id };
}

/**
 * Send magic link for the invitee. Never return the link to callers.
 * Uses service-role client so delivery does not depend on the owner's browser.
 */
export async function sendInviteMagicLink(
  email: string,
  joinPath: string,
): Promise<void> {
  const normalized = normalizeInviteEmail(email);
  const origin =
    publicAppOrigin() ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
      : "http://127.0.0.1:3000");
  const confirmUrl = new URL("/auth/confirm", origin);
  confirmUrl.searchParams.set("next", joinPath);

  const admin = createAdminClient();
  const { error } = await admin.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: confirmUrl.toString(),
    },
  });
  if (error) {
    throw new Error(error.message || "Couldn’t send invite email");
  }
}
