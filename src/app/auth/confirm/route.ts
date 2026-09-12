import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveConfirmAuth } from "./confirm-params";

export async function GET(request: NextRequest) {
  const auth = resolveConfirmAuth(request.nextUrl.searchParams);
  if (auth.kind === "invalid") redirect("/login?error=confirm");

  const supabase = await createClient();
  const { error } =
    auth.kind === "token"
      ? await supabase.auth.verifyOtp({
          type: auth.type,
          token_hash: auth.token_hash,
        })
      : await supabase.auth.exchangeCodeForSession(auth.code);

  redirect(error ? "/login?error=confirm" : "/");
}
