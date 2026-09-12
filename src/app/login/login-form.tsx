"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const SUCCESS = "If that address can sign in, check your inbox.";
const RATE_LIMITED =
  "Too many sign-in emails just now. Wait about an hour (Supabase free mail limit), then try once.";

function isRateLimitError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("429")
  );
}

export function LoginForm({ authError = null }: { authError?: string | null }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(authError);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setStatus(isRateLimitError(error?.message) ? RATE_LIMITED : SUCCESS);
    setPending(false);
  }

  return (
    <form className="max-w-md space-y-5" onSubmit={onSubmit}>
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
      <button type="submit" className="btn btn-primary" disabled={pending}>
        Email me a link
      </button>
      {status ? (
        <p
          role={status === SUCCESS ? undefined : "alert"}
          className={status === SUCCESS ? "text-sm text-herb" : "alert"}
        >
          {status}
        </p>
      ) : null}
    </form>
  );
}
