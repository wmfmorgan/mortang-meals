import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { resolveConfirmAuth } from "@/app/auth/confirm/confirm-params";
import type { ConfirmOtpType } from "@/app/auth/confirm/otp-type";
import { acceptPendingInviteForUser } from "@/household/members-repo";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

function failPath(next: string): string {
  return next !== "/"
    ? `/login?error=confirm&next=${encodeURIComponent(next)}`
    : "/login?error=confirm";
}

async function verifyToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token_hash: string,
  type: ConfirmOtpType,
) {
  let { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (!error) return null;
  // Templates sometimes disagree with the OTP kind (email vs magiclink).
  const fallback: ConfirmOtpType =
    type === "email" ? "magiclink" : type === "magiclink" ? "email" : type;
  if (fallback !== type) {
    ({ error } = await supabase.auth.verifyOtp({
      type: fallback,
      token_hash,
    }));
  }
  return error;
}

/**
 * Server-side magic-link / OTP confirm.
 * Sets session cookies on the redirect response so middleware sees the user
 * (client-side confirm + router.replace often races and dumps existing users
 * back on /login).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next")) ?? "/";
  const auth = resolveConfirmAuth(searchParams);

  if (auth.kind === "invalid" || auth.kind === "implicit") {
    redirect(failPath(next));
  }

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (auth.kind === "token") {
    error = await verifyToken(supabase, auth.token_hash, auth.type);
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
