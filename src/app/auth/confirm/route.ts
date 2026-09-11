import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (!token_hash || type !== "email") redirect("/login");
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash });
  redirect(error ? "/login" : "/");
}
