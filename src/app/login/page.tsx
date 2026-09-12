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
      ? "Google sign-in didn’t finish. Try Continue with Google again."
      : null;

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Sign in"
        lede="Invite-only. Use Google with the email an admin already added for you."
      />
      <LoginForm authError={authError} />
    </div>
  );
}
