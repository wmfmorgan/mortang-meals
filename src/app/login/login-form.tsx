"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const SUCCESS = "If that address can sign in, check your inbox.";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    const supabase = createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setStatus(SUCCESS);
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
      {status ? <p className="text-sm text-herb">{status}</p> : null}
    </form>
  );
}
