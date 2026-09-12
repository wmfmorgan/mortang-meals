"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ authError = null }: { authError?: string | null }) {
  const [status, setStatus] = useState<string | null>(authError);
  const [pending, setPending] = useState(false);

  async function onGoogle() {
    setPending(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/confirm`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setStatus(error.message);
      setPending(false);
    }
    // On success the browser navigates away to Google.
  }

  return (
    <div className="max-w-md space-y-5">
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => void onGoogle()}
      >
        Continue with Google
      </button>
      {status ? (
        <p role="alert" className="alert">
          {status}
        </p>
      ) : null}
    </div>
  );
}
