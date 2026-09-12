import { PageHeader } from "@/components/page-header";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const authError =
    params.error === "confirm"
      ? "That sign-in link expired or was already used. Request a new one below."
      : null;

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Sign in"
        lede="Invite-only. We'll email a magic link if this address can sign in."
      />
      <LoginForm authError={authError} />
    </div>
  );
}
