"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ authError = null }: { authError?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(authError);
  const [pending, setPending] = useState(false);

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
    router.replace("/");
    router.refresh();
  }

  async function sendMagicLink() {
    setPending(true);
    setStatus(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${origin}/auth/confirm`,
      },
    });
    setPending(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("If that address can sign in, check your inbox for a link.");
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
