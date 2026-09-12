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
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        Sign in
      </button>
      {status ? (
        <p role="alert" className="alert">
          {status}
        </p>
      ) : null}
    </form>
  );
}
