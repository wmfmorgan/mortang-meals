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
  const [mode, setMode] = useState<"link" | "password">("link");
  const [status, setStatus] = useState<string | null>(authError);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const afterLogin = safeNextPath(next) ?? "/";

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
      if (isOtpUnknownUserError(error.message)) {
        setSentTo(trimmed);
        return;
      }
      setStatus(error.message);
      return;
    }
    setSentTo(trimmed);
  }

  async function signInWithPasswordSubmit() {
    if (!password.trim()) {
      setStatus("Enter your password.");
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "link") {
      await sendMagicLink();
      return;
    }
    await signInWithPasswordSubmit();
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-[1.75rem] font-bold tracking-tight">
          Check your inbox
        </h1>
        <p role="status" className="notice">
          {OTP_INBOX_MESSAGE}
        </p>
        <p className="text-sm text-herb">{sentTo}</p>
        <button
          type="button"
          className="btn btn-ghost min-h-11 w-full"
          onClick={() => {
            setSentTo(null);
            setStatus(null);
            setMode("link");
          }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  const primaryLabel =
    mode === "link"
      ? pending
        ? "Sending link…"
        : "Email me a link"
      : pending
        ? "Signing in…"
        : "Sign in";

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(event) => void onSubmit(event)}
    >
      <div>
        <h1 className="font-display text-[1.75rem] font-bold tracking-tight">
          Sign in
        </h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-herb">
          {mode === "link"
            ? "We’ll email you a sign-in link."
            : "Sign in with your password."}
        </p>
      </div>
      {status ? (
        <p role="alert" className="alert">
          {status}
        </p>
      ) : null}
      <label className="field">
        Email
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus={mode === "link"}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {mode === "password" ? (
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            name="password"
            id="login-password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      ) : null}
      <div className="space-y-2">
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {primaryLabel}
        </button>
        <button
          type="button"
          className="btn btn-ghost min-h-11 w-full"
          disabled={pending}
          aria-expanded={mode === "password"}
          aria-controls={mode === "password" ? "login-password" : undefined}
          onClick={() => {
            setMode(mode === "link" ? "password" : "link");
            setStatus(null);
          }}
        >
          {mode === "link" ? "Use a password instead" : "Email me a link instead"}
        </button>
      </div>
    </form>
  );
}
