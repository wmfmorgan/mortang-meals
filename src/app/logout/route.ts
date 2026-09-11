import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signOutAndRedirect() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function POST() {
  await signOutAndRedirect();
}
