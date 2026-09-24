import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { resolveConfirmAuth } from "@/app/auth/confirm/confirm-params";
import { parseConfirmOtpType } from "@/app/auth/confirm/otp-type";
import { verifyTokenHash } from "@/app/auth/callback/verify-otp";
import { acceptPendingInviteForUser } from "@/household/members-repo";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

function failPath(next: string): string {
  return next !== "/"
    ? `/login?error=confirm&next=${encodeURIComponent(next)}`
    : "/login?error=confirm";
}

/**
 * Consumes the magic-link OTP. GET /auth/callback only renders a Continue
 * button so email scanners (Outlook Safe Links) do not burn the token.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const next = safeNextPath(String(form.get("next") ?? "")) ?? "/";
  const query = new URLSearchParams();
  const token_hash = String(form.get("token_hash") ?? "");
  const type = parseConfirmOtpType(String(form.get("type") ?? "") || null);
  const code = String(form.get("code") ?? "");
  if (token_hash && type) {
    query.set("token_hash", token_hash);
    query.set("type", type);
  } else if (code) {
    query.set("code", code);
  }
  const auth = resolveConfirmAuth(query);

  if (auth.kind === "invalid" || auth.kind === "implicit") {
    redirect(failPath(next));
  }

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (auth.kind === "token") {
    error = await verifyTokenHash(
      (input) => supabase.auth.verifyOtp(input),
      auth.token_hash,
      auth.type,
    );
  } else {
    ({ error } = await supabase.auth.exchangeCodeForSession(auth.code));
  }

  if (error) {
    redirect(failPath(next));
  }

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (typeof userId === "string" && email) {
    try {
      const joined = await acceptPendingInviteForUser(userId, email);
      if (joined) {
        redirect("/");
      }
    } catch {
      // Sign-in succeeded; join can be retried from /setup or /join.
    }
  }

  redirect(next);
}
