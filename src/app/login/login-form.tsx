"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { publicAppOrigin } from "@/lib/public-app-origin";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-next-path";

const OTP_INBOX_MESSAGE =
  "If that address can sign in, check your inbox for a link.";

/** Unknown / non-invited addresses must not enumerate users. */
function isOtpUnknownUserError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("signups not allowed") ||
    lower.includes("user not found") ||
    lower.includes("unable to validate email") ||
    lower.includes("email not found")
  );
}

export function LoginForm({
  authError = null,
  next = null,
}: {
  authError?: string | null;
  next?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(authError);
  const [pending, setPending] = useState(false);
  const afterLogin = safeNextPath(next) ?? "/";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!password.trim()) {
      setStatus("Enter your password, or use Email me a link.");
      return;
    }
    setPending(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message);
      setPending(false);
      return;
    }
    router.replace(afterLogin);
    router.refresh();
  }

  async function sendMagicLink() {
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("Enter your email.");
      return;
    }
    setPending(true);
    setStatus(null);
    const supabase = createClient();
    const origin = publicAppOrigin(window.location.origin);
    const callbackUrl = new URL("/auth/callback", origin);
    if (afterLogin !== "/") {
      callbackUrl.searchParams.set("next", afterLogin);
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callbackUrl.toString(),
      },
    });
    setPending(false);
    if (error) {
      setStatus(
        isOtpUnknownUserError(error.message) ? OTP_INBOX_MESSAGE : error.message,
      );
      return;
    }
    setStatus(OTP_INBOX_MESSAGE);
  }

  return (
    <form className="max-w-md space-y-5" onSubmit={(event) => void onSubmit(event)}>
      <label className="field">
        Email
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="field">
        Password
        <input
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Sign in
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => void sendMagicLink()}
        >
          Email me a link
        </button>
      </div>
      {status ? (
        <p role="alert" className="alert">
          {status}
        </p>
      ) : null}
    </form>
  );
}
