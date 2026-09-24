"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeInviteSignInAction } from "@/app/household/actions";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-next-path";
import { resolveBrowserConfirmAuth } from "./confirm-params";

export function ConfirmClient() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const params = new URLSearchParams(window.location.search);
      const rawNext = safeNextPath(params.get("next"));
      const next = rawNext ?? "/";
      const confirmFailure = rawNext
        ? `/login?error=confirm&next=${encodeURIComponent(rawNext)}`
        : "/login?error=confirm";
      const auth = resolveBrowserConfirmAuth(
        window.location.search,
        window.location.hash,
      );
      if (auth.kind === "invalid") {
        router.replace(confirmFailure);
        return;
      }

      const supabase = createClient();
      let error: { message: string } | null = null;

      if (auth.kind === "token") {
        ({ error } = await supabase.auth.verifyOtp({
          type: auth.type,
          token_hash: auth.token_hash,
        }));
      } else if (auth.kind === "code") {
        ({ error } = await supabase.auth.exchangeCodeForSession(auth.code));
      } else {
        ({ error } = await supabase.auth.setSession({
          access_token: auth.access_token,
          refresh_token: auth.refresh_token,
        }));
      }

      if (cancelled) return;
      if (error) {
        setMessage(error.message);
        router.replace(confirmFailure);
        return;
      }

      // Email invites: join the household immediately (template often omits ?next=).
      setMessage("Finishing invite…");
      const inviteResult = await completeInviteSignInAction();
      if (cancelled) return;
      if (inviteResult.ok && inviteResult.joined) {
        router.replace("/");
        router.refresh();
        return;
      }

      router.replace(next);
      router.refresh();
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-sm text-herb">{message}</p>
    </main>
  );
}
